import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { verifyStripeSignature } from '@/lib/stripe'
import { notifyInvoicePaid } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

type StripeEvent = {
  type: string
  data: { object: { id: string; customer: string } }
}

// POST /api/webhooks/stripe
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  if (secret && !verifyStripeSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: StripeEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event.type === 'invoice.paid') {
    const invoiceId = event.data.object.id
    const supabase = createSupabaseAdmin()

    const { data: onboarding, error } = await supabase
      .from('onboardings')
      .select('*')
      .eq('stripe_invoice_id', invoiceId)
      .single()

    if (error || !onboarding) {
      console.error('[stripe webhook] no onboarding for invoice', invoiceId)
      return NextResponse.json({ ok: true, ignored: true })
    }

    if (!onboarding.paid) {
      const { data: updated } = await supabase
        .from('onboardings')
        .update({ paid: true, invoice_paid_at: new Date().toISOString() })
        .eq('id', onboarding.id)
        .select()
        .single()

      if (updated) notifyInvoicePaid(updated)
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true, ignored: event.type })
}
