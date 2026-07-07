import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { verifySignwellEvent } from '@/lib/signwell'
import { findOrCreateClientForOnboarding, sendWelcomeEmail } from '@/lib/onboarding-server'
import { notifyContractSigned } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

type SignwellEvent = {
  event: { type: string; time: number | string; hash: string }
  data: { object: { id: string } }
}

// POST /api/webhooks/signwell
// Delivered as a plain JSON POST body (unlike Dropbox Sign's multipart form).
export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as SignwellEvent
    const { type: eventType, time: eventTime, hash: eventHash } = payload.event

    if (!verifySignwellEvent(eventType, eventTime, eventHash)) {
      return NextResponse.json({ error: 'Invalid event hash' }, { status: 401 })
    }

    if (eventType === 'document_completed') {
      const documentId = payload.data?.object?.id
      if (!documentId) return NextResponse.json({ ok: true })

      const supabase = createSupabaseAdmin()
      const { data: onboarding, error } = await supabase
        .from('onboardings')
        .select('*')
        .eq('esign_document_id', documentId)
        .single()

      if (error || !onboarding) {
        console.error('[signwell webhook] no onboarding for document', documentId)
        return NextResponse.json({ ok: true })
      }

      // Idempotent: SignWell can redeliver events.
      if (onboarding.status === 'won' || onboarding.status === 'contract_sent') {
        const clientId = await findOrCreateClientForOnboarding(onboarding)
        const now = new Date().toISOString()

        const { data: updated } = await supabase
          .from('onboardings')
          .update({
            status: 'signed',
            contract_signed_at: now,
            client_id: clientId,
          })
          .eq('id', onboarding.id)
          .select()
          .single()

        await sendWelcomeEmail(onboarding)
        if (updated) notifyContractSigned(updated)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[signwell webhook]', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
