import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { logUpdate } from '@/lib/updates'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET/POST /api/cron/daily-digest
// Runs once a day (see vercel.json). Rolls up yesterday's activity across
// cold calling, cold email, gov contracts, tasks and client meetings into a
// single os_updates row so the Updates tab reflects what actually happened
// without anyone typing it in by hand. Plain Supabase counts, no LLM calls.
// Idempotent: reruns for the same day are a no-op if a Digest row already
// exists for that date.
export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createSupabaseAdmin()

  // UTC day boundaries. "Yesterday" is the day this digest reports on;
  // "today" is only used for the meetings-scheduled-today count.
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setUTCDate(todayStart.getUTCDate() - 1)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setUTCDate(todayStart.getUTCDate() + 1)

  const yesterdayDateStr = toDateStr(yesterdayStart)
  const todayDateStr = toDateStr(todayStart)
  const yesterdayStartIso = yesterdayStart.toISOString()
  const yesterdayEndIso = todayStart.toISOString()
  const todayStartIso = todayStart.toISOString()
  const todayEndIso = tomorrowStart.toISOString()

  const title = `Daily digest for ${yesterdayDateStr}`

  // Idempotency: skip if a Digest row for this date already exists.
  const { data: existing } = await supabase
    .from('os_updates')
    .select('id')
    .eq('tag', 'Digest')
    .eq('title', title)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ skipped: true, reason: 'already logged', title })
  }

  const errors: string[] = []
  const logErr = (label: string, error: { message: string } | null) => {
    if (error) {
      console.error(`[daily-digest] ${label}`, error)
      errors.push(`${label}: ${error.message}`)
    }
  }

  const [
    eodRes,
    ceReplyRes,
    ceBookingsRes,
    govRes,
    tasksCompletedRes,
    tasksCreatedRes,
    meetingsHeldRes,
    meetingsTodayRes,
  ] = await Promise.all([
    supabase
      .from('eod_reports')
      .select('calls_made, positive_replies, calls_booked')
      .eq('report_date', yesterdayDateStr),
    supabase
      .from('ce_events')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'reply_in')
      .gte('occurred_at', yesterdayStartIso)
      .lt('occurred_at', yesterdayEndIso),
    supabase
      .from('ce_bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterdayStartIso)
      .lt('created_at', yesterdayEndIso),
    supabase
      .from('gov_instantly_daily')
      .select('emails_sent_total, replies_total')
      .eq('date', yesterdayDateStr)
      .maybeSingle(),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .gte('completed_at', yesterdayStartIso)
      .lt('completed_at', yesterdayEndIso),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterdayStartIso)
      .lt('created_at', yesterdayEndIso),
    supabase
      .from('client_meetings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'done')
      .gte('scheduled_at', yesterdayStartIso)
      .lt('scheduled_at', yesterdayEndIso),
    supabase
      .from('client_meetings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .gte('scheduled_at', todayStartIso)
      .lt('scheduled_at', todayEndIso),
  ])

  logErr('eod_reports', eodRes.error)
  logErr('ce_events', ceReplyRes.error)
  logErr('ce_bookings', ceBookingsRes.error)
  logErr('gov_instantly_daily', govRes.error)
  logErr('tasks completed', tasksCompletedRes.error)
  logErr('tasks created', tasksCreatedRes.error)
  logErr('client_meetings held', meetingsHeldRes.error)
  logErr('client_meetings today', meetingsTodayRes.error)

  const eodRows = eodRes.data ?? []
  const callsMade = eodRows.reduce((s, r) => s + (r.calls_made ?? 0), 0)
  const positiveReplies = eodRows.reduce((s, r) => s + (r.positive_replies ?? 0), 0)
  const callsBooked = eodRows.reduce((s, r) => s + (r.calls_booked ?? 0), 0)

  const ceReplies = ceReplyRes.count ?? 0
  const ceBookings = ceBookingsRes.count ?? 0

  const emailsSent = govRes.data?.emails_sent_total ?? 0
  const govReplies = govRes.data?.replies_total ?? 0

  const tasksCompleted = tasksCompletedRes.count ?? 0
  const tasksCreated = tasksCreatedRes.count ?? 0

  const meetingsHeld = meetingsHeldRes.count ?? 0
  const meetingsToday = meetingsTodayRes.count ?? 0

  // Build one line per surface, listing only the sub-metrics that are non-zero,
  // and dropping the whole line if every sub-metric for that surface is zero.
  const lines: string[] = []

  const coldCallingParts: string[] = []
  if (callsMade > 0) coldCallingParts.push(`${callsMade} dials`)
  if (positiveReplies > 0) coldCallingParts.push(`${positiveReplies} positive`)
  if (callsBooked > 0) coldCallingParts.push(`${callsBooked} booked`)
  if (coldCallingParts.length) lines.push(`Cold calling: ${coldCallingParts.join(', ')}.`)

  const coldEmailParts: string[] = []
  if (ceReplies > 0) coldEmailParts.push(`${ceReplies} replies`)
  if (ceBookings > 0) coldEmailParts.push(`${ceBookings} booked`)
  if (coldEmailParts.length) lines.push(`Cold email: ${coldEmailParts.join(', ')}.`)

  const govParts: string[] = []
  if (emailsSent > 0) govParts.push(`${emailsSent} sent`)
  if (govReplies > 0) govParts.push(`${govReplies} replies`)
  if (govParts.length) lines.push(`Gov: ${govParts.join(', ')}.`)

  const taskParts: string[] = []
  if (tasksCompleted > 0) taskParts.push(`${tasksCompleted} done`)
  if (tasksCreated > 0) taskParts.push(`${tasksCreated} new`)
  if (taskParts.length) lines.push(`Tasks: ${taskParts.join(', ')}.`)

  const meetingParts: string[] = []
  if (meetingsHeld > 0) meetingParts.push(`${meetingsHeld} held yesterday`)
  if (meetingsToday > 0) meetingParts.push(`${meetingsToday} today`)
  if (meetingParts.length) lines.push(`Meetings: ${meetingParts.join(', ')}.`)

  const description = lines.length
    ? lines.join('\n')
    : `No cold calling, cold email, gov, task or meeting activity recorded for ${yesterdayDateStr}.`

  // Falls back to the New tag until the os_updates tag constraint allows Digest.
  const update = (await logUpdate(title, description, 'Digest'))
    ?? (await logUpdate(title, description, 'New'))

  return NextResponse.json({
    logged: Boolean(update),
    title,
    description,
    errors: errors.length ? errors : undefined,
  })
}
