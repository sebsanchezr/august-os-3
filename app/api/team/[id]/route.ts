import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['cold_caller', 'sales_manager', 'other'] as const
const VALID_STATUSES = ['onboarding', 'active', 'paused', 'offboarded'] as const

// GET /api/team/[id] -- member + its onboarding (if any) + checklist tasks
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { data: member, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: onboardingRow } = await supabase
    .from('staff_onboardings')
    .select('*')
    .eq('team_member_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let onboarding = null
  if (onboardingRow) {
    const { data: tasks } = await supabase
      .from('staff_onboarding_tasks')
      .select('*')
      .eq('onboarding_id', onboardingRow.id)
      .order('position', { ascending: true })

    onboarding = { ...onboardingRow, tasks: tasks ?? [] }
  }

  return NextResponse.json({ member, onboarding })
}

// PATCH /api/team/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (body.role != null && !(VALID_ROLES as readonly string[]).includes(body.role as string)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }
  if (body.status != null && !(VALID_STATUSES as readonly string[]).includes(body.status as string)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  const allowed = [
    'name', 'title', 'role', 'email', 'phone', 'whatsapp', 'location',
    'avatar_url', 'login_email', 'discord_user_id', 'status', 'start_date',
    'commission_notes',
  ]
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data: member, error } = await supabase
    .from('team_members')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error || !member) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  return NextResponse.json({ member })
}

// DELETE /api/team/[id]
// Hard delete: team_members has no archive flag. Any linked staff_onboardings
// row keeps its history (team_member_id is set null via FK ON DELETE SET NULL).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { error } = await supabase.from('team_members').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
