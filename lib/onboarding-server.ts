// Server-only helpers shared between the SignWell webhook and the
// onboarding start route: client linkage and the welcome email.
import { createSupabaseAdmin } from '@/lib/supabase-server'

export function portalUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_ONBOARDING_PORTAL_BASE_URL || 'https://augustosv3.vercel.app'
  return `${base}/welcome/${token}`
}

// The Pipeline "won" stage already auto-creates a bare clients row
// (name-only). Adopt that row if one exists and isn't already linked to an
// onboarding, rather than creating a duplicate client.
export async function findOrCreateClientForOnboarding(onboarding: {
  id: string
  company_name: string
  contact_name: string | null
  contact_email: string
  fee_amount: number
  currency: string
}): Promise<string> {
  const supabase = createSupabaseAdmin()

  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', onboarding.company_name)
    .is('onboarding_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('clients')
      .update({
        onboarding_id: onboarding.id,
        contact_name: onboarding.contact_name,
        contact_email: onboarding.contact_email,
        mrr: onboarding.fee_amount,
        currency: onboarding.currency,
      })
      .eq('id', existing.id)
    return existing.id
  }

  const { data: created, error } = await supabase
    .from('clients')
    .insert({
      name: onboarding.company_name,
      status: 'active',
      onboarding_id: onboarding.id,
      contact_name: onboarding.contact_name,
      contact_email: onboarding.contact_email,
      mrr: onboarding.fee_amount,
      currency: onboarding.currency,
    })
    .select('id')
    .single()

  if (error || !created) throw new Error(error?.message ?? 'Failed to create client')
  return created.id
}

export async function sendWelcomeEmail(onboarding: {
  contact_email: string
  contact_name: string | null
  company_name: string
  portal_token: string
}): Promise<void> {
  const RESEND_KEY = process.env.RESEND_API_KEY
  const FROM = process.env.RESEND_FROM_EMAIL || 'August Marketing <team@augustmarketing.co.uk>'
  if (!RESEND_KEY) {
    console.error('[onboarding] RESEND_API_KEY not configured, skipping welcome email')
    return
  }

  const url = portalUrl(onboarding.portal_token)
  const firstName = (onboarding.contact_name ?? onboarding.company_name).split(' ')[0]

  const html = `
    <div style="font-family:system-ui,sans-serif;color:#111;line-height:1.6;max-width:600px">
      <h2 style="margin:0 0 12px">Welcome to August, ${firstName}.</h2>
      <p>Your contract is signed and your onboarding portal is now live. Head over to watch a quick welcome video from Seb, complete your onboarding form, and book your kickoff call:</p>
      <p style="margin:24px 0">
        <a href="${url}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open your onboarding portal</a>
      </p>
      <p style="color:#555;font-size:14px">Any questions, just reply to this email — a human answers same day.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
      <p style="margin:0;color:#555;font-size:14px">Sent via August Marketing</p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [onboarding.contact_email],
      subject: `Welcome to August, ${firstName} — your onboarding portal is live`,
      html,
    }),
  })

  if (!res.ok) {
    console.error('[onboarding] welcome email failed', await res.text())
  }
}
