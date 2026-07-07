// Google Calendar read access for the Monday meeting sync cron
// (see app/api/cron/calendar-sync/route.ts).
//
// Reuses the same service-account pattern already running in
// agents/06_meeting_tasks (Google Drive, read-only). No new OAuth app or
// consent screen is needed: the same GCP project's service account is
// granted the Calendar readonly scope, and Seb shares his calendar with the
// service account's email address (exactly like the Drive transcripts
// folder is already shared with it).
//
// MANUAL SETUP REQUIRED (Seb, one-time, ~5 minutes):
//   1. In console.cloud.google.com, on the same project as the existing
//      Drive service account, enable the "Google Calendar API".
//   2. Open Google Calendar > Settings > [your calendar] > "Share with
//      specific people" > add the service account's email (the
//      "client_email" field inside the GOOGLE_SERVICE_ACCOUNT_JSON key) >
//      permission "See all event details".
//   3. Set env var GOOGLE_CALENDAR_ID to the calendar's id. For a primary
//      Google Workspace/Gmail calendar this is just the email address
//      (e.g. seb@augustmarketing.co.uk).
//   4. GOOGLE_SERVICE_ACCOUNT_JSON is already set for the Drive agent; it
//      is reused here unchanged (same JSON, works for both APIs once both
//      scopes are requested, no need for a second key).
//
// Until these are done, isGoogleCalendarConfigured() returns false and the
// cron route no-ops instead of fabricating data.

import { google } from 'googleapis'

export class GoogleCalendarNotConfiguredError extends Error {}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_CALENDAR_ID)
}

function loadServiceAccountInfo(): Record<string, unknown> {
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '').trim()
  if (!raw) throw new GoogleCalendarNotConfiguredError('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  // Same env var supports either a raw JSON string or a filesystem path,
  // matching agents/06_meeting_tasks/meeting_agent.py's _build_drive_service.
  if (raw.startsWith('{')) return JSON.parse(raw)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs')
  return JSON.parse(fs.readFileSync(raw, 'utf-8'))
}

function buildCalendarClient() {
  const info = loadServiceAccountInfo()
  const auth = new google.auth.GoogleAuth({
    credentials: info as { client_email: string; private_key: string },
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })
  return google.calendar({ version: 'v3', auth })
}

export type CalendarEvent = {
  id: string
  summary: string
  description: string | null
  start: string // ISO datetime
  end: string   // ISO datetime
  attendees: string[] // email addresses
  status: string // confirmed | tentative | cancelled
}

// Lists events on GOOGLE_CALENDAR_ID between `from` and `to` (ISO datetimes).
export async function listCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  if (!isGoogleCalendarConfigured()) {
    throw new GoogleCalendarNotConfiguredError('GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_CALENDAR_ID missing')
  }
  const calendar = buildCalendarClient()
  const calendarId = process.env.GOOGLE_CALENDAR_ID!

  const res = await calendar.events.list({
    calendarId,
    timeMin: from,
    timeMax: to,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  })

  return (res.data.items ?? [])
    .filter(e => e.status !== 'cancelled' && e.id && e.start)
    .map(e => ({
      id: e.id!,
      summary: e.summary ?? '(no title)',
      description: e.description ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      attendees: (e.attendees ?? []).map(a => a.email).filter((email): email is string => Boolean(email)),
      status: e.status ?? 'confirmed',
    }))
    .filter(e => e.start)
}
