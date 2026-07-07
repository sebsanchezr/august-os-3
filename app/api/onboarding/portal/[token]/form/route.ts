import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyFormCompleted } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// POST /api/onboarding/portal/[token]/form
// Public, token-guarded — this is the only form the client ever fills in.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data: onboarding, error: fetchErr } = await supabase
    .from('onboardings')
    .select('id, status, company_name')
    .eq('portal_token', params.token)
    .single()

  if (fetchErr || !onboarding) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (onboarding.status === 'won' || onboarding.status === 'contract_sent') {
    return NextResponse.json({ error: 'Portal is not unlocked yet — waiting on the signed contract' }, { status: 422 })
  }

  const fields = [
    'business_overview', 'target_audience', 'brand_guidelines_url', 'asset_links',
    'access_notes', 'goals', 'primary_contact', 'billing_contact', 'timezone',
  ] as const

  const formRow: Record<string, unknown> = { onboarding_id: onboarding.id, extra: body.extra ?? {} }
  for (const field of fields) {
    if (field in body) formRow[field] = body[field]
  }

  const { error: insertErr } = await supabase.from('onboarding_forms').insert(formRow)
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  const now = new Date().toISOString()
  const { data: updated } = await supabase
    .from('onboardings')
    .update(
      onboarding.status === 'signed'
        ? { status: 'form_completed', form_completed_at: now }
        : { form_completed_at: now },
    )
    .eq('id', onboarding.id)
    .select()
    .single()

  if (updated) notifyFormCompleted(updated)

  return NextResponse.json({ ok: true })
}
