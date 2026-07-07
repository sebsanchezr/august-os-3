import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { draftPrepPack } from '@/lib/meeting-ai'
import { notifyMeetingPrepPack } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// GET/POST /api/cron/meeting-prep
// Runs every 30 minutes (see vercel.json). For every scheduled meeting that
// starts in the next 2-4h window and doesn't have a prep pack yet, pulls
// context (metrics, open tasks/issues, talking points, last meeting) and
// drafts: an internal prep brief, the call agenda, and a ready-to-copy
// pre-meeting message. Posts the agenda + message straight to Discord so
// Seb can paste them without opening the OS. Also creates a meeting_prep
// client_reports row so it shows up in the Meetings hub / approvals.
async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createSupabaseAdmin()

  const now = new Date()
  const windowStart = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString()

  const { data: meetings, error } = await supabase
    .from('client_meetings')
    .select('id, client_id, type, scheduled_at, agenda, clients(id, name, contact_name, contact_email)')
    .eq('status', 'scheduled')
    .is('prep_ready_at', null)
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let prepped = 0

  for (const meeting of meetings ?? []) {
    const client = Array.isArray(meeting.clients) ? meeting.clients[0] : meeting.clients
    if (!client) continue

    try {
      await prepOne(supabase, meeting, client)
      prepped++
    } catch (e) {
      console.error(`meeting-prep failed for meeting ${meeting.id}:`, e)
    }
  }

  return NextResponse.json({ checked: meetings?.length ?? 0, prepped })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function prepOne(supabase: any, meeting: any, client: any) {
  const scheduledAt = new Date(meeting.scheduled_at)
  const today = scheduledAt.toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(scheduledAt.getTime() - 7 * 86400000).toISOString().slice(0, 10)
  const fourteenDaysAgo = new Date(scheduledAt.getTime() - 14 * 86400000).toISOString().slice(0, 10)

  const [metricsRes, tasksRes, issuesRes, pointsRes, lastMeetingRes] = await Promise.all([
    supabase.from('client_metrics_daily').select('date, spend, revenue, roas, purchases')
      .eq('client_id', client.id).gte('date', fourteenDaysAgo).lt('date', today),
    supabase.from('tasks').select('title, status')
      .eq('client_id', client.id).is('deleted_at', null).not('status', 'in', '(done,uploaded,live)'),
    supabase.from('client_issues').select('category, severity, description')
      .eq('client_id', client.id).neq('status', 'resolved'),
    supabase.from('client_talking_points').select('point')
      .eq('client_id', client.id).is('consumed_by_report', null),
    supabase.from('client_meetings').select('id, minutes_md')
      .eq('client_id', client.id).eq('status', 'done').lt('scheduled_at', meeting.scheduled_at)
      .order('scheduled_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const dailyMetrics: { date: string; spend: number; revenue: number; roas: number | null; purchases: number }[] = metricsRes.data ?? []
  const thisWeek = dailyMetrics.filter(d => d.date >= sevenDaysAgo)
  const priorWeek = dailyMetrics.filter(d => d.date < sevenDaysAgo)

  function sumWeek(rows: typeof dailyMetrics) {
    if (!rows.length) return null
    const spend = rows.reduce((s, r) => s + (r.spend ?? 0), 0)
    const revenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0)
    const purchases = rows.reduce((s, r) => s + (r.purchases ?? 0), 0)
    return { spend, revenue, roas: spend > 0 ? revenue / spend : null, purchases }
  }

  let lastMeetingActionItems: { title: string; status: string }[] = []
  const lastMeeting = lastMeetingRes.data
  if (lastMeeting) {
    const { data: actionItems } = await supabase
      .from('tasks')
      .select('title, status')
      .eq('meeting_ref', lastMeeting.id)
      .is('deleted_at', null)
    lastMeetingActionItems = actionItems ?? []
  }

  const prep = await draftPrepPack({
    clientName: client.name,
    contactName: client.contact_name ?? null,
    meetingType: meeting.type,
    scheduledAt: meeting.scheduled_at,
    metricsThisWeek: sumWeek(thisWeek),
    metricsPriorWeek: sumWeek(priorWeek),
    openTasks: tasksRes.data ?? [],
    openIssues: issuesRes.data ?? [],
    talkingPoints: (pointsRes.data ?? []).map((p: { point: string }) => p.point),
    lastMeetingMinutes: lastMeeting?.minutes_md ?? null,
    lastMeetingActionItems,
  })

  const { data: report } = await supabase
    .from('client_reports')
    .insert({
      client_id: client.id,
      type: 'meeting_prep',
      period_start: sevenDaysAgo,
      period_end: today,
      metrics: { this_week: sumWeek(thisWeek), prior_week: sumWeek(priorWeek) },
      draft_md: prep.prepMd,
      client_message: prep.preMeetingMessage,
      status: 'pending_approval',
      discord_notified_at: new Date().toISOString(), // we notify directly below with full content
    })
    .select('id')
    .single()

  const now = new Date().toISOString()
  await supabase
    .from('client_meetings')
    .update({
      prep_report_id: report?.id ?? null,
      prep_ready_at: now,
      agenda: meeting.agenda || prep.agenda,
      updated_at: now,
    })
    .eq('id', meeting.id)

  notifyMeetingPrepPack(
    { id: client.id, name: client.name },
    { id: meeting.id, scheduled_at: meeting.scheduled_at, type: meeting.type },
    prep.agenda,
    prep.preMeetingMessage,
  )
}

export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}
