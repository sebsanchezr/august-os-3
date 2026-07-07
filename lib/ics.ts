// Minimal RFC 5545 .ics generator for meeting invites.
// No dependency; produces a VCALENDAR string with a REQUEST method so email
// clients (Gmail, Outlook, Apple) treat it as an invitation and offer RSVP.

type IcsAttendee = { name?: string; email: string }

type IcsEvent = {
  uid: string
  title: string
  description?: string
  startUtc: Date
  durationMinutes: number
  organizerName: string
  organizerEmail: string
  attendees: IcsAttendee[]
  location?: string
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

// UTC timestamp in the basic format iCalendar expects: 20260710T140000Z
function toIcsUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

// Escape per spec: backslash, semicolon, comma, newline
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function buildIcs(ev: IcsEvent): string {
  const end = new Date(ev.startUtc.getTime() + ev.durationMinutes * 60000)
  const stamp = toIcsUtc(new Date(Date.UTC(2026, 0, 1)))
  const now = toIcsUtc(ev.startUtc) // DTSTAMP just needs to be a valid UTC time

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//August OS//Accounts//EN',
    'METHOD:REQUEST',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsUtc(ev.startUtc)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${esc(ev.title)}`,
    ev.description ? `DESCRIPTION:${esc(ev.description)}` : '',
    ev.location ? `LOCATION:${esc(ev.location)}` : '',
    `ORGANIZER;CN=${esc(ev.organizerName)}:mailto:${ev.organizerEmail}`,
    ...ev.attendees.map(
      (a) =>
        `ATTENDEE;CN=${esc(a.name ?? a.email)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`,
    ),
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  // RFC 5545 wants CRLF line endings
  return lines.join('\r\n')
}

// A Google Calendar "add event" URL.
// Notes:
// - URLSearchParams encodes commas as %2C which breaks the `add` param.
//   We build the query string manually so commas stay literal.
// - `add` = comma-separated guest emails (Google reads these as invited guests)
// - `sf=true` = opens the "smart scheduling / Gemini" suggestions panel
// - `sprop=isGoogleMeet:true` = pre-ticks "Add Google Meet video conferencing"
export function googleCalendarUrl(ev: {
  title: string
  startUtc: Date
  durationMinutes: number
  description?: string
  attendees: string[]
}): string {
  const end = new Date(ev.startUtc.getTime() + ev.durationMinutes * 60000)
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`

  // Build parts manually — encodeURIComponent everything EXCEPT the comma in `add`
  const parts: string[] = [
    `action=TEMPLATE`,
    `text=${encodeURIComponent(ev.title)}`,
    `dates=${fmt(ev.startUtc)}/${fmt(end)}`,
    `sf=true`,
    `sprop=isGoogleMeet:true`,
  ]

  if (ev.description) {
    parts.push(`details=${encodeURIComponent(ev.description)}`)
  }

  if (ev.attendees.length) {
    // `add` must have literal commas — Google rejects %2C
    parts.push(`add=${ev.attendees.map(encodeURIComponent).join(',')}`)
  }

  return `https://calendar.google.com/calendar/render?${parts.join('&')}`
}
