// Gmail read access for the post-meeting transcript poller
// (see app/api/cron/meeting-followup/route.ts).
//
// Reuses the same GCP service account as the Calendar sync and the Drive
// transcript agent. Reading a *user's* mailbox needs domain-wide delegation:
// the service account impersonates seb@augustmarketing.co.uk. Calendar sharing
// (the Calendar pattern) is not enough for Gmail, so this needs one extra
// one-time step.
//
// MANUAL SETUP REQUIRED (Seb, one-time):
//   1. In console.cloud.google.com, on the service account, enable
//      "Domain-wide delegation" and note the client ID.
//   2. In Google Workspace Admin (admin.google.com) > Security > API Controls >
//      Domain-wide delegation, add the service account client ID with scope
//      https://www.googleapis.com/auth/gmail.readonly
//   3. Set env GOOGLE_IMPERSONATE_SUBJECT=seb@augustmarketing.co.uk
//      (the mailbox to read). GOOGLE_SERVICE_ACCOUNT_JSON is reused unchanged.
//
// Until GOOGLE_IMPERSONATE_SUBJECT is set, isGmailConfigured() returns false
// and the followup cron skips the transcript step instead of erroring.

import { google } from 'googleapis'

export class GmailNotConfiguredError extends Error {}

export function isGmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_IMPERSONATE_SUBJECT)
}

function loadServiceAccountInfo(): Record<string, unknown> {
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '').trim()
  if (!raw) throw new GmailNotConfiguredError('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  if (raw.startsWith('{')) return JSON.parse(raw)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs')
  return JSON.parse(fs.readFileSync(raw, 'utf-8'))
}

function buildGmailClient() {
  const info = loadServiceAccountInfo()
  const auth = new google.auth.JWT({
    email: info.client_email as string,
    key: info.private_key as string,
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    subject: process.env.GOOGLE_IMPERSONATE_SUBJECT!,
  })
  return google.gmail({ version: 'v1', auth })
}

export type TranscriptEmail = {
  id: string
  subject: string
  from: string
  snippet: string
  body: string
  internalDate: number // ms epoch
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

// Recursively pulls the text/plain (fallback text/html stripped) body out of a
// Gmail message payload.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBody(payload: any): string {
  if (!payload) return ''
  if (payload.body?.data && (payload.mimeType === 'text/plain' || !payload.parts)) {
    const text = decodeBase64Url(payload.body.data)
    return payload.mimeType === 'text/html' ? text.replace(/<[^>]+>/g, ' ') : text
  }
  if (payload.parts) {
    const plain = payload.parts.find((p: any) => p.mimeType === 'text/plain')
    if (plain?.body?.data) return decodeBase64Url(plain.body.data)
    // recurse (multipart/alternative, nested)
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested) return nested
    }
  }
  return ''
}

// Searches the impersonated mailbox with a Gmail query string and returns the
// full text of up to `maxResults` matching messages. Used to find a meeting
// transcript (from a notetaker like Fathom / Fireflies / Google Meet) landing
// after a call. Read-only.
export async function searchTranscriptEmails(query: string, maxResults = 5): Promise<TranscriptEmail[]> {
  if (!isGmailConfigured()) {
    throw new GmailNotConfiguredError('GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_IMPERSONATE_SUBJECT missing')
  }
  const gmail = buildGmailClient()
  const list = await gmail.users.messages.list({ userId: 'me', q: query, maxResults })
  const messages = list.data.messages ?? []

  const out: TranscriptEmail[] = []
  for (const m of messages) {
    if (!m.id) continue
    const full = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' })
    const headers = full.data.payload?.headers ?? []
    const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value ?? ''
    const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value ?? ''
    out.push({
      id: m.id,
      subject,
      from,
      snippet: full.data.snippet ?? '',
      body: extractBody(full.data.payload),
      internalDate: Number(full.data.internalDate ?? 0),
    })
  }
  return out
}
