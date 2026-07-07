import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyOnboardingLaunched } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// POST /api/onboarding/[id]/launch
// Payment is a gate on launch, not on the welcome portal — this route is the
// only place status can become 'launched', and it refuses if unpaid.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()

  const { data: onboarding, error: fetchErr } = await supabase
    .from('onboardings')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchErr || !onboarding) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!onboarding.paid) {
    return NextResponse.json({ error: 'Invoice unpaid — cannot launch. Resend or manually confirm payment first.' }, { status: 422 })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('onboardings')
    .update({ status: 'launched', launched_at: now })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (onboarding.client_id) {
    await supabase.from('clients').update({ status: 'active', start_date: now.slice(0, 10) }).eq('id', onboarding.client_id)
  }

  notifyOnboardingLaunched(data)

  return NextResponse.json({ onboarding: data })
}
