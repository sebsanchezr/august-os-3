import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { listCalendarEvents, isGoogleCalendarConfigured } from '@/lib/google-calendar'
import { notifyCalendarSynced } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET/POST /api/cron/calendar-sync
// Runs every Monday morning (see vercel.json). Pulls Seb's Google Calendar
// for the coming week and upserts matching events into client_meetings so
// the Meetings hub always has the week loaded without manual entry.
//
// Requires GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_CALENDAR_ID to be set and
// the calendar shared with the service account (see lib/google-calendar.ts
// for the one-time manual setup steps). Until then this route no-ops.
//
// Matching: an event is linked to a client if the client's name appears in
// the event summary, or an attendee email's domain matches the client's
// contact_email domain. Unmatched events are skipped, not fabricated into
// meetings, and counted so the Discord summary shows what needs manual
// entry.
export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json({
      skipped: true,
      reason: 'GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_CALENDAR_ID not configured. See lib/google-calendar.ts for setup steps.',
    })
  }

  const supabase = createSupabaseAdmin()

  // Week window: from today 00:00 UTC through 7 days out. Cron is scheduled
  // for Monday, so in practice this is "this week", but computing it off
  // "now" rather than hardcoding Monday keeps a manual/late run correct too.
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  let events
  try {
    events = await listCalendarEvents(weekStart.toISOString(), weekEnd.toISOString())
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Calendar fetch failed' }, { status: 500 })
  }

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, contact_email')
    .eq('status', 'active')

  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 })

  function matchClient(summary: string, attendees: string[]) {
    const lowerSummary = summary.toLowerCase()
    const byName = (clients ?? []).find(c => lowerSummary.includes(c.name.toLowerCase()))
    if (byName) return byName

    const attendeeDomains = attendees.map(a => a.split('@')[1]?.toLowerCase()).filter(Boolean)
    return (clients ?? []).find(c => {
      const domain = c.contact_email?.split('@')[1]?.toLowerCase()
      return domain && attendeeDomains.includes(domain)
    }) ?? null
  }

  let added = 0
  let updated = 0
  let skipped = 0

  for (const event of events) {
    const client = matchClient(event.summary, event.attendees)
    if (!client) {
      skipped++
      continue
    }

    const durationMinutes = event.end && event.start
      ? Math.max(1, Math.round((new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000))
      : 30

    const { data: existing } = await supabase
      .from('client_meetings')
      .select('id')
      .eq('google_event_id', event.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('client_meetings')
        .update({
          scheduled_at: event.start,
          duration_minutes: durationMinutes,
          attendees: event.attendees,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      updated++
    } else {
      await supabase.from('client_meetings').insert({
        client_id: client.id,
        type: 'weekly',
        scheduled_at: event.start,
        duration_minutes: durationMinutes,
        attendees: event.attendees,
        status: 'scheduled',
        google_event_id: event.id,
      })
      added++
    }
  }

  const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${new Date(weekEnd.getTime() - 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  notifyCalendarSynced({ added, updated, skipped, weekLabel })

  return NextResponse.json({ eventsFound: events.length, added, updated, skipped })
}
