import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { verifyStripeSignature } from '@/lib/stripe'
import { notifyInvoicePaid, notifyWebsitePaid } from '@/lib/discord-notify'
import { DEFAULT_HOOKUP_TASKS } from '@/lib/websites'

export const dynamic = 'force-dynamic'

type StripeEvent = {
  type: string
  data: {
    object: {
      id: string
      customer: string
      // checkout.session.completed fields
      client_reference_id?: string | null
      amount_total?: number | null
      customer_details?: { email?: string | null; name?: string | null } | null
    }
  }
}

// A website sale closed: the caller sent a Stripe Payment Link carrying the
// build id as client_reference_id. Mark the build paid, seed the hookup
// checklist, enrol the client on the newsletter, and ping Discord.
async function handleWebsiteCheckout(session: StripeEvent['data']['object']) {
  const buildId = session.client_reference_id
  if (!buildId) return NextResponse.json({ ok: true, ignored: 'no client_reference_id' })

  const supabase = createSupabaseAdmin()
  const { data: build, error } = await supabase
    .from('website_builds')
    .select('*')
    .eq('id', buildId)
    .single()

  if (error || !build) {
    console.error('[stripe webhook] no website_build for session', buildId)
    return NextResponse.json({ ok: true, ignored: true })
  }
  if (build.paid_at) return NextResponse.json({ ok: true, alreadyPaid: true })

  const amount = session.amount_total ? session.amount_total / 100 : null
  const email = session.customer_details?.email ?? build.email ?? null

  await supabase
    .from('website_builds')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      sale_amount: amount,
      stripe_session_id: session.id,
      hookup_status: 'not_started',
      email,
      updated_at: new Date().toISOString(),
    })
    .eq('id', buildId)

  // Seed the hookup checklist (idempotent-ish: only if none exist yet).
  const { count } = await supabase
    .from('website_hookup_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('build_id', buildId)
  if (!count) {
    await supabase.from('website_hookup_tasks').insert(
      DEFAULT_HOOKUP_TASKS.map((title, i) => ({ build_id: buildId, title, position: i })),
    )
  }

  // Enrol on the local-businesses newsletter (unique on email, ignore dupes).
  if (email) {
    await supabase.from('newsletter_subscribers').upsert(
      { business_name: build.business_name, email, city: build.city ?? build.service_area ?? null, source: 'site_purchase', website_build_id: buildId },
      { onConflict: 'email', ignoreDuplicates: true },
    )
    await supabase.from('website_builds').update({ newsletter_enrolled: true }).eq('id', buildId)
  }

  notifyWebsitePaid({ business_name: build.business_name, amount, requested_by: build.requested_by })
  return NextResponse.json({ ok: true })
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

  if (event.type === 'checkout.session.completed') {
    return handleWebsiteCheckout(event.data.object)
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
