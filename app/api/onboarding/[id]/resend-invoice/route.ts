import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { resendStripeInvoice } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// POST /api/onboarding/[id]/resend-invoice
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { data: onboarding, error: fetchErr } = await supabase
    .from('onboardings')
    .select('stripe_invoice_id')
    .eq('id', params.id)
    .single()

  if (fetchErr || !onboarding) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!onboarding.stripe_invoice_id) {
    return NextResponse.json({ error: 'No Stripe invoice on this onboarding yet' }, { status: 422 })
  }

  try {
    await resendStripeInvoice(onboarding.stripe_invoice_id)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to resend invoice' }, { status: 500 })
  }

  await supabase
    .from('onboardings')
    .update({ invoice_sent_at: new Date().toISOString() })
    .eq('id', params.id)

  return NextResponse.json({ resent: true })
}
