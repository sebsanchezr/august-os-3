import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { listCalendarEvents, isGoogleCalendarConfigured } from '@/lib/google-calendar'
import { notifyCalendarSynced } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET/POST /api/cron/calendar-sync
// Runs every Monday morning (see vercel.json). Pulls Seb's Google Calendar
// for the coming 3 weeks and upserts matching events into client_meetings so
// the Meetings hub always has the weeks ahead loaded without manual entry.
//
// Requires GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_CALENDAR_ID to be set and
// the calendar shared with the service account (see lib/google-calendar.ts
// for the one-time manual setup steps). Until then this route no-ops.
//
// Matching: an event is linked to a client if the client's name, or any of
// its aliases (migration 028_client_aliases.sql), appears in the event
// summary, or an attendee email's domain matches the client's contact_email
// domain. Aliases exist because the team calls clients by shorthand (e.g.
// "Coffee" for Coffuel, "Desanti" for Disanti Studio) that never matches the
// formal client name. Unmatched events are skipped, not fabricated into
// meetings, and counted so the Discord summary shows what needs manual
// entry.
//
// Cancellation: any previously synced meeting (has a google_event_id, still
// 'scheduled', within the fetched window) whose event is no longer present
// in the fetch (deleted or cancelled on the calendar) is marked 'cancelled'.
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

  // Window: from today 00:00 UTC through 21 days out. Cron is scheduled for
  // Monday, so in practice this covers "this week" plus the two after it,
  // computed off "now" rather than hardcoded Monday so a manual/late run is
  // still correct.
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 21)

  let events
  try {
    events = await listCalendarEvents(weekStart.toISOString(), weekEnd.toISOString())
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Calendar fetch failed' }, { status: 500 })
  }

  type ClientRow = { id: string; name: string; contact_email: string | null; aliases: string[] }

  let clients: ClientRow[] | null = null
  let clientsError: { message: string } | null = null

  // aliases (migration 028) may not exist yet if this deploys before the
  // migration runs; fall back to a query without it so sync still works.
  {
    const res = await supabase
      .from('clients')
      .select('id, name, contact_email, aliases')
      .eq('status', 'active')

    if (res.error) {
      const fallback = await supabase
        .from('clients')
        .select('id, name, contact_email')
        .eq('status', 'active')
      clients = (fallback.data ?? []).map(c => ({ ...c, aliases: [] as string[] }))
      clientsError = fallback.error
    } else {
      clients = (res.data ?? []).map(c => ({ ...c, aliases: (c as { aliases?: string[] }).aliases ?? [] }))
    }
  }

  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 })

  function matchClient(summary: string, attendees: string[]) {
    const lowerSummary = summary.toLowerCase()
    const byNameOrAlias = (clients ?? []).find(c => {
      if (lowerSummary.includes(c.name.toLowerCase())) return true
      return (c.aliases ?? []).some(alias => alias && lowerSummary.includes(alias.toLowerCase()))
    })
    if (byNameOrAlias) return byNameOrAlias

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

  // Mark previously synced meetings as cancelled if their event is no longer
  // in the fetched window (deleted or cancelled on the calendar; the Google
  // API already excludes status 'cancelled' events from `events`, so absence
  // from the fetched id set is the only signal available).
  const fetchedEventIds = new Set(events.map(e => e.id))
  let cancelled = 0

  const { data: previouslySynced } = await supabase
    .from('client_meetings')
    .select('id, google_event_id')
    .eq('status', 'scheduled')
    .not('google_event_id', 'is', null)
    .gte('scheduled_at', weekStart.toISOString())
    .lt('scheduled_at', weekEnd.toISOString())

  for (const row of previouslySynced ?? []) {
    if (row.google_event_id && !fetchedEventIds.has(row.google_event_id)) {
      await supabase
        .from('client_meetings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', row.id)
      cancelled++
    }
  }

  const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${new Date(weekEnd.getTime() - 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  notifyCalendarSynced({ added, updated, skipped, weekLabel })

  return NextResponse.json({ eventsFound: events.length, added, updated, skipped, cancelled })
}
