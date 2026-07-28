// Shared config for the website cold-call sale loop.
// Used by the Websites page (Stripe link picker) and the Stripe webhook
// (hookup checklist seeding). No secrets here — payment link URLs are public
// pay pages, read from env so they can change without a code deploy.

export type SaleTier = 'site_1500' | 'site_2000'

export type PaymentLinkOption = {
  tier: SaleTier
  label: string
  amount: number // GBP, one-time build fee
  url: string    // Stripe Payment Link base URL (empty if not configured yet)
}

// Base Stripe Payment Link URLs. Create three links in the Stripe dashboard
// (£1,500 build, £2,000 build, £75/mo hosting subscription) and set these envs.
// The caller-facing picker appends ?client_reference_id=<build_id> so the
// checkout webhook can match the payment back to the right build.
export const PAYMENT_LINKS: PaymentLinkOption[] = [
  {
    tier: 'site_1500',
    label: 'Website build — £1,500',
    amount: 1500,
    url: process.env.NEXT_PUBLIC_STRIPE_LINK_SITE_1500 ?? '',
  },
  {
    tier: 'site_2000',
    label: 'Website build — £2,000',
    amount: 2000,
    url: process.env.NEXT_PUBLIC_STRIPE_LINK_SITE_2000 ?? '',
  },
]

// £75/mo hosting & maintenance subscription. Sent alongside the build link.
export const HOSTING_LINK = process.env.NEXT_PUBLIC_STRIPE_LINK_HOSTING_75 ?? ''

// Appends the build id to a payment link so Stripe echoes it back on the
// checkout.session.completed webhook via client_reference_id.
export function paymentLinkFor(baseUrl: string, buildId: string): string {
  if (!baseUrl) return ''
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}client_reference_id=${encodeURIComponent(buildId)}`
}

// Seeded into website_hookup_tasks when a build is paid. Fulfilment works these
// to take the paid preview site live on the client's real domain.
export const DEFAULT_HOOKUP_TASKS: string[] = [
  'Buy or point the client domain to Vercel',
  'Attach the custom domain to the Vercel project',
  'Swap the preview subdomain for the real domain',
  'Set up business email forwarding (if requested)',
  'Final QA pass on live domain (mobile + desktop)',
  'Send the handover email to the client',
  'Confirm £75/mo hosting subscription is active',
  'Add client to the local-businesses newsletter list',
]
