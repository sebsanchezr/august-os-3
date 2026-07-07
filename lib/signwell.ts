// Thin SignWell REST wrapper, no SDK dependency — mirrors the plain-fetch
// pattern already used for Resend, Discord, and Stripe in this codebase.
// Switched from Dropbox Sign because Dropbox Sign requires a paid plan to
// send any real (non-test) signature request via API, template or not.
// SignWell's API is pay-as-you-go (25 free docs/month, then per-document),
// with templates and webhooks included at every tier.
import crypto from 'crypto'

const API_KEY = process.env.SIGNWELL_API_KEY ?? ''
const TEMPLATE_ID = process.env.SIGNWELL_TEMPLATE_ID ?? ''
const BASE = 'https://www.signwell.com/api/v1'

export async function sendContractFromTemplate(opts: {
  clientLegalName: string
  signerName: string
  signerEmail: string
  service: string
  deliverables?: string
  feeAmount: number
  currency: string
  termMonths?: number
}): Promise<string> {
  if (!API_KEY || !TEMPLATE_ID) throw new Error('SIGNWELL_API_KEY / SIGNWELL_TEMPLATE_ID not configured')

  // No StartDate field: the contract's Start Date is the date campaigns go
  // live, which isn't known yet when the contract is sent — it's described
  // as an event in the contract text (clause 2.1), not a merged date.
  const body = {
    template_id: TEMPLATE_ID,
    test_mode: process.env.SIGNWELL_TEST_MODE === 'true',
    draft: false,
    name: `Service Agreement — ${opts.clientLegalName}`,
    subject: `August Marketing — Services Agreement (${opts.clientLegalName})`,
    message: 'Please review and sign to get your onboarding started. Your welcome portal unlocks the moment this is signed.',
    recipients: [
      { id: '1', name: opts.signerName, email: opts.signerEmail, placeholder_name: 'Client' },
    ],
    template_fields: [
      { api_id: 'ClientLegalName', value: opts.clientLegalName },
      { api_id: 'ClientSignatoryName', value: opts.signerName },
      { api_id: 'ClientSignatoryEmail', value: opts.signerEmail },
      { api_id: 'ServiceName', value: opts.service },
      { api_id: 'Deliverables', value: opts.deliverables || 'To be confirmed at kickoff' },
      { api_id: 'FeeAmount', value: String(opts.feeAmount) },
      { api_id: 'Currency', value: opts.currency },
      { api_id: 'TermMonths', value: String(opts.termMonths ?? 3) },
      { api_id: 'EffectiveDate', value: new Date().toISOString().slice(0, 10) },
    ],
  }

  const res = await fetch(`${BASE}/document_templates/documents`, {
    method: 'POST',
    headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    const message = json?.errors?.[0]?.message ?? json?.message ?? 'SignWell request failed'
    throw new Error(message)
  }
  return json.id as string
}

// SignWell event verification: HMAC-SHA256 of "<event_type>@<event_time>"
// using the webhook's own ID (not the API key) as the secret, compared
// against event.hash.
export function verifySignwellEvent(eventType: string, eventTime: number | string, eventHash: string): boolean {
  const webhookId = process.env.SIGNWELL_WEBHOOK_ID ?? ''
  if (!webhookId || !eventHash) return false
  const data = `${eventType}@${eventTime}`
  const expected = crypto.createHmac('sha256', webhookId).update(data).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(eventHash), Buffer.from(expected))
  } catch {
    return false
  }
}
