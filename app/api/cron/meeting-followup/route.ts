import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { searchTranscriptEmails, isGmailConfigured } from '@/lib/google-gmail'
import { draftPostMeetingMessage } from '@/lib/meeting-ai'
import { notifyPostMeetingMessage } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// GET/POST /api/cron/meeting-followup
// Runs every 30 minutes (see vercel.json). The post-meeting half of the
// lifecycle: starting 1 hour after a call's scheduled end, it searches Seb's
// inbox for the meeting transcript (from a notetaker like Fathom / Fireflies /
// Google Meet). When one is found it drafts a client-facing follow-up message
// and posts it to Discord for Seb to copy/paste.
//
// Idempotent: post_meeting_sent_at guards against double-posting. Meetings are
// only polled for a 3-day window after they happen, so nothing is polled
// forever. Requires Gmail domain-wide delegation (GOOGLE_IMPERSONATE_SUBJECT) —
// until that is set the transcript step is skipped (no-op), never errors.

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

  if (!isGmailConfigured()) {
    return NextResponse.json({
      skipped: true,
      reason: 'GOOGLE_IMPERSONATE_SUBJECT not configured. See lib/google-gmail.ts for the domain-wide delegation setup.',
    })
  }

  const supabase = createSupabaseAdmin()
  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

  // Candidate meetings: happened recently, ended over an hour ago, no follow-up
  // sent yet. scheduled_at <= oneHourAgo is a coarse filter; the per-row check
  // below adds the meeting's duration so we truly wait until end + 1h.
  const { data: meetings, error } = await supabase
    .from('client_meetings')
    .select('id, client_id, type, scheduled_at, duration_minutes, clients(id, name, contact_name)')
    .neq('status', 'cancelled')
    .is('post_meeting_sent_at', null)
    .gte('scheduled_at', threeDaysAgo)
    .lte('scheduled_at', oneHourAgo)
    .order('scheduled_at', { ascending: true })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  let checked = 0

  for (const meeting of meetings ?? []) {
    const client = Array.isArray(meeting.clients) ? meeting.clients[0] : meeting.clients
    if (!client) continue

    const start = new Date(meeting.scheduled_at)
    const endPlusHour = new Date(start.getTime() + (meeting.duration_minutes ?? 30) * 60000 + 60 * 60 * 1000)
    if (now < endPlusHour) continue // not yet 1h after the scheduled end

    checked++
    try {
      const found = await findTranscript(client.name, start, now)
      const checkedAt = new Date().toISOString()

      if (!found) {
        await supabase.from('client_meetings').update({ followup_checked_at: checkedAt }).eq('id', meeting.id)
        continue
      }

      const message = await draftPostMeetingMessage({
        clientName: client.name,
        contactName: client.contact_name ?? null,
        meetingType: meeting.type,
        scheduledAt: meeting.scheduled_at,
        transcript: found.body || found.snippet,
      })

      // Stamp sent_at before the Discord post so an overlapping run can't
      // double-draft. notify is fire-and-forget.
      await supabase
        .from('client_meetings')
        .update({
          transcript_found_at: checkedAt,
          post_meeting_message: message,
          post_meeting_sent_at: checkedAt,
          followup_checked_at: checkedAt,
          updated_at: checkedAt,
        })
        .eq('id', meeting.id)

      notifyPostMeetingMessage(
        { id: client.id, name: client.name },
        { id: meeting.id, scheduled_at: meeting.scheduled_at, type: meeting.type },
        message,
      )
      sent++
    } catch (e) {
      console.error(`meeting-followup failed for meeting ${meeting.id}:`, e)
    }
  }

  return NextResponse.json({ candidates: meetings?.length ?? 0, checked, sent })
}

// Searches the inbox for a transcript email for this client that landed after
// the meeting started. Notetakers vary, so the query is broad; the internalDate
// filter keeps it to emails after the call.
async function findTranscript(clientName: string, meetingStart: Date, now: Date) {
  const daysBack = Math.max(1, Math.ceil((now.getTime() - meetingStart.getTime()) / 86400000) + 1)
  const safeName = clientName.replace(/"/g, '')
  const query = `newer_than:${daysBack}d ("${safeName}") (transcript OR recording OR "meeting notes" OR "call notes" OR fathom OR fireflies OR otter OR "meet recording")`

  const emails = await searchTranscriptEmails(query, 5)
  const afterStart = emails
    .filter(e => e.internalDate >= meetingStart.getTime())
    .sort((a, b) => a.internalDate - b.internalDate)
  return afterStart[0] ?? null
}
