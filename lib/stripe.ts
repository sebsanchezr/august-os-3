// Thin Stripe REST wrapper, no SDK dependency — mirrors the plain-fetch pattern
// already used for Resend and Discord in this codebase.
import crypto from 'crypto'

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? ''
const BASE = 'https://api.stripe.com/v1'

type StripeObject = Record<string, unknown>

async function stripeFetch(path: string, params: Record<string, string>): Promise<StripeObject> {
  if (!STRIPE_KEY) throw new Error('STRIPE_SECRET_KEY not configured')
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  const json = await res.json()
  if (!res.ok) {
    const message = (json as { error?: { message?: string } }).error?.message ?? 'Stripe request failed'
    throw new Error(message)
  }
  return json
}

// Full fee upfront: create the Customer, add one invoice item for the full
// amount, finalize the invoice with collection_method=send_invoice so Stripe
// emails the client a hosted invoice link automatically.
export async function createStripeCustomerAndInvoice(opts: {
  email: string
  name: string
  description: string
  amount: number // major units, e.g. GBP pounds
  currency: string
  onboardingId: string
  daysUntilDue?: number
}): Promise<{ customerId: string; invoiceId: string; invoiceUrl: string }> {
  const customer = await stripeFetch('/customers', {
    email: opts.email,
    name: opts.name,
    'metadata[onboarding_id]': opts.onboardingId,
  })

  await stripeFetch('/invoiceitems', {
    customer: customer.id as string,
    currency: opts.currency.toLowerCase(),
    amount: String(Math.round(opts.amount * 100)),
    description: opts.description,
  })

  const invoice = await stripeFetch('/invoices', {
    customer: customer.id as string,
    collection_method: 'send_invoice',
    days_until_due: String(opts.daysUntilDue ?? 3),
    auto_advance: 'true',
    'metadata[onboarding_id]': opts.onboardingId,
  })

  const finalized = await stripeFetch(`/invoices/${invoice.id as string}/finalize`, {})

  return {
    customerId: customer.id as string,
    invoiceId: finalized.id as string,
    invoiceUrl: finalized.hosted_invoice_url as string,
  }
}

// Re-sends the existing hosted invoice email via Stripe (does not create a new invoice).
export async function resendStripeInvoice(invoiceId: string): Promise<void> {
  if (!STRIPE_KEY) throw new Error('STRIPE_SECRET_KEY not configured')
  const res = await fetch(`${BASE}/invoices/${invoiceId}/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error((json as { error?: { message?: string } }).error?.message ?? 'Failed to resend invoice')
  }
}

// Stripe-Signature header format: "t=<timestamp>,v1=<hex hmac>"
// Signed payload is "<timestamp>.<raw body>", HMAC-SHA256 with the webhook secret.
export function verifyStripeSignature(rawBody: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader || !secret) return false
  const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=') as [string, string]))
  const timestamp = parts.t
  const signature = parts.v1
  if (!timestamp || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
