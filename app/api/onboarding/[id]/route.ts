import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = [
  'won', 'contract_sent', 'signed', 'form_completed', 'kickoff_booked',
  'kickoff_held', 'building', 'launched', 'handed_off',
] as const

// GET /api/onboarding/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('onboardings')
    .select('*, pipeline_deals(id, prospect_name), clients(id, name), onboarding_forms(*)')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ onboarding: data }, { headers: { 'Cache-Control': 'no-store' } })
}

// PATCH /api/onboarding/[id]
// Manual overrides: notes, health, and status moves that don't require an
// external integration (building, handed_off, or an amber/red correction).
// Launching is gated separately at /api/onboarding/[id]/launch because it
// enforces the paid invariant.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.status === 'launched') {
    return NextResponse.json(
      { error: 'Use POST /api/onboarding/[id]/launch to move to launched — it enforces the paid invoice gate' },
      { status: 400 },
    )
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  const allowedFields = [
    'status', 'notes', 'health', 'paid', 'invoice_paid_at', 'contact_name',
    'contact_email', 'internal_brief', 'kickoff_at',
  ] as const

  const patch: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) patch[field] = body[field]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('onboardings')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ onboarding: data })
}
