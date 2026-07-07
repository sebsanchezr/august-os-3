import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyKickoffBooked } from '@/lib/discord-notify'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Verify Cal.com webhook signature if secret is configured
function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.CAL_WEBHOOK_SECRET
  if (!secret) return true // no secret configured — allow all (lock down once live)
  if (!signature) return false
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

// Extract the best available business/contact name from Cal.com payload
function extractName(payload: Record<string, unknown>): string {
  const responses = payload.responses as Record<string, { value: string }> | undefined
  return (
    responses?.company?.value ||
    responses?.businessName?.value ||
    responses?.business_name?.value ||
    (payload.attendees as Array<{ name: string }>)?.[0]?.name ||
    responses?.name?.value ||
    'Unknown'
  )
}

// Onboarding kickoff bookings pass onboarding_id through as a hidden/prefilled
// field on the Cal.com embed (see components/onboarding/welcome-portal.tsx).
// It comes back either in `responses` or in Cal's `metadata` bag depending on
// how the field was configured, so check both.
function extractOnboardingId(payload: Record<string, unknown>): string | null {
  const responses = payload.responses as Record<string, { value: string }> | undefined
  const metadata = payload.metadata as Record<string, string> | undefined
  return responses?.onboardingId?.value || metadata?.onboardingId || null
}

// Extract phone from responses
function extractPhone(payload: Record<string, unknown>): string | null {
  const responses = payload.responses as Record<string, { value: string }> | undefined
  return (
    responses?.phone?.value ||
    responses?.phoneNumber?.value ||
    responses?.phone_number?.value ||
    null
  )
}

// Extract niche/business type from event type name or responses
function extractNiche(payload: Record<string, unknown>): string | null {
  const responses = payload.responses as Record<string, { value: string }> | undefined
  const type = payload.type as string | undefined
  return (
    responses?.niche?.value ||
    responses?.businessType?.value ||
    responses?.industry?.value ||
    (type ? type.toLowerCase() : null) ||
    null
  )
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('X-Cal-Signature-256')

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody) as {
      triggerEvent: string
      payload: Record<string, unknown>
    }

    const { triggerEvent, payload } = event

    const supabase = createSupabaseAdmin()

    if (triggerEvent === 'BOOKING_CREATED') {
      const onboardingId = extractOnboardingId(payload)
      if (onboardingId) {
        const startTime = payload.startTime as string | null
        const { data: updated } = await supabase
          .from('onboardings')
          .update({ status: 'kickoff_booked', kickoff_at: startTime })
          .eq('id', onboardingId)
          .in('status', ['signed', 'form_completed'])
          .select()
          .single()

        if (updated) {
          notifyKickoffBooked(updated, startTime ?? 'time TBC')
        }
        return NextResponse.json({ ok: true, onboarding_id: onboardingId })
      }

      const businessName = extractName(payload)
      const phone = extractPhone(payload)
      const niche = extractNiche(payload)
      const callTime = payload.startTime as string | null
      const calBookingUid = payload.uid as string | null

      const { error } = await supabase.from('bookings').insert({
        business_name: businessName,
        phone,
        call_time: callTime,
        niche,
        source: 'cal_com',
        prep_doc_url: calBookingUid ? `https://cal.com/booking/${calBookingUid}` : null,
        status: 'booked',
      })

      if (error) {
        console.error('[cal webhook] insert error', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log(`[cal webhook] Booking created: ${businessName} at ${callTime}`)
      return NextResponse.json({ ok: true, business_name: businessName })
    }

    if (triggerEvent === 'BOOKING_CANCELLED' || triggerEvent === 'BOOKING_REJECTED') {
      const calBookingUid = payload.uid as string | null
      if (calBookingUid) {
        await supabase
          .from('bookings')
          .update({ status: 'lost' })
          .eq('prep_doc_url', `https://cal.com/booking/${calBookingUid}`)
      }
      return NextResponse.json({ ok: true })
    }

    // Unhandled event type — acknowledge and ignore
    return NextResponse.json({ ok: true, ignored: triggerEvent })
  } catch (err) {
    console.error('[cal webhook]', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
