import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { ONBOARDING_STAGES } from '@/lib/team-server'
import { notifyProvisionLogin } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// GET /api/team/onboarding/[id] -- onboarding + its checklist tasks
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { data: onboarding, error } = await supabase
    .from('staff_onboardings')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !onboarding) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: tasks } = await supabase
    .from('staff_onboarding_tasks')
    .select('*')
    .eq('onboarding_id', id)
    .order('position', { ascending: true })

  return NextResponse.json({ onboarding, tasks: tasks ?? [] })
}

// PATCH /api/team/onboarding/[id]
// Handles stage moves (drag on the board), date fields, contract url, notes, position.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (body.stage != null && !(ONBOARDING_STAGES as readonly string[]).includes(body.stage as string)) {
    return NextResponse.json({ error: `stage must be one of: ${ONBOARDING_STAGES.join(', ')}` }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await supabase
    .from('staff_onboardings')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = [
    'stage', 'intro_meeting_at', 'day7_review_at', 'contract_url', 'notes',
    'position', 'candidate_name', 'role', 'team_member_id',
  ]
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const stageChanged = typeof body.stage === 'string' && body.stage !== existing.stage
  const newStage = stageChanged ? (body.stage as string) : existing.stage

  // Auto-set the day-7 review date the first time the candidate reaches
  // ramp_learning or intro_booked, if it hasn't been set already.
  if (stageChanged && (newStage === 'ramp_learning' || newStage === 'intro_booked') && !existing.day7_review_at && !('day7_review_at' in body)) {
    const day7 = new Date()
    day7.setDate(day7.getDate() + 7)
    patch.day7_review_at = day7.toISOString()
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data: onboarding, error } = await supabase
    .from('staff_onboardings')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error || !onboarding) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })

  if (stageChanged && newStage === 'details_collected') {
    notifyProvisionLogin(onboarding.candidate_name ?? 'Candidate', null)
  }

  return NextResponse.json({ onboarding })
}
