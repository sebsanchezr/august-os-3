import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { createStripeCustomerAndInvoice } from '@/lib/stripe'
import { sendContractFromTemplate } from '@/lib/signwell'
import { notifyOnboardingStarted } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// POST /api/onboarding/start
// The single click that fires the onboarding machine: creates the onboarding
// record, a Stripe Customer + full-fee-upfront Invoice, and a SignWell
// contract from the master template. Portal unlocks later, on signature.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const companyName = body.company_name as string | undefined
  const contactEmail = body.contact_email as string | undefined
  const service = body.service as string | undefined
  const feeAmount = Number(body.fee_amount)

  if (!companyName) return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
  if (!contactEmail) return NextResponse.json({ error: 'contact_email is required' }, { status: 400 })
  if (!service) return NextResponse.json({ error: 'service is required' }, { status: 400 })
  if (!feeAmount || feeAmount <= 0) return NextResponse.json({ error: 'fee_amount must be greater than 0' }, { status: 400 })

  const contactName = (body.contact_name as string | undefined) ?? companyName
  const deliverables = (body.deliverables as string | undefined) ?? null
  const currency = (body.currency as string | undefined) ?? 'GBP'
  const termMonths = Number(body.term_months) || 3
  const dealId = (body.deal_id as string | undefined) ?? null

  const supabase = createSupabaseAdmin()
  const portalToken = crypto.randomBytes(24).toString('hex')

  const { data: onboarding, error: insertErr } = await supabase
    .from('onboardings')
    .insert({
      deal_id: dealId,
      company_name: companyName,
      contact_name: contactName,
      contact_email: contactEmail,
      service,
      deliverables,
      fee_amount: feeAmount,
      currency,
      status: 'won',
      portal_token: portalToken,
    })
    .select()
    .single()

  if (insertErr || !onboarding) {
    return NextResponse.json({ error: insertErr?.message ?? 'Failed to create onboarding' }, { status: 500 })
  }

  const errors: string[] = []
  const patch: Record<string, unknown> = {}

  try {
    const { customerId, invoiceId, invoiceUrl } = await createStripeCustomerAndInvoice({
      email: contactEmail,
      name: contactName,
      description: `${service} — ${companyName}`,
      amount: feeAmount,
      currency,
      onboardingId: onboarding.id,
    })
    patch.stripe_customer_id = customerId
    patch.stripe_invoice_id = invoiceId
    patch.stripe_invoice_url = invoiceUrl
    patch.invoice_sent_at = new Date().toISOString()
  } catch (err) {
    console.error('[onboarding/start] Stripe failed', err)
    errors.push(`Stripe: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  try {
    const documentId = await sendContractFromTemplate({
      clientLegalName: companyName,
      signerName: contactName,
      signerEmail: contactEmail,
      service,
      deliverables: deliverables ?? undefined,
      feeAmount,
      currency,
      termMonths,
    })
    patch.esign_document_id = documentId
    patch.contract_sent_at = new Date().toISOString()
  } catch (err) {
    console.error('[onboarding/start] SignWell failed', err)
    errors.push(`SignWell: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  // Advance to contract_sent only if at least the contract went out — the
  // client can't do anything until they have something to sign.
  if (patch.esign_document_id) {
    patch.status = 'contract_sent'
  }
  if (errors.length > 0) {
    patch.notes = [onboarding.notes, `Start errors: ${errors.join('; ')}`].filter(Boolean).join('\n')
  }

  const { data: updated, error: updateErr } = await supabase
    .from('onboardings')
    .update(patch)
    .eq('id', onboarding.id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  notifyOnboardingStarted(updated)

  if (errors.length > 0) {
    return NextResponse.json({ onboarding: updated, warnings: errors }, { status: 207 })
  }

  return NextResponse.json({ onboarding: updated }, { status: 201 })
}
