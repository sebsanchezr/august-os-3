import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { DEFAULT_ONBOARDING_TASKS } from '@/lib/team-server'
import { notifyStaffWelcome } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['cold_caller', 'sales_manager', 'other'] as const

// GET /api/team/onboarding
// Returns every staff_onboardings row with its linked team member + task
// completion counts, for the kanban board.
export async function GET(_req: NextRequest) {
  const supabase = createSupabaseAdmin()

  const { data: onboardings, error } = await supabase
    .from('staff_onboardings')
    .select(`*, team_member:team_members(id, name, avatar_url)`)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (onboardings ?? []).map((o) => o.id)
  const { data: tasks } = await supabase
    .from('staff_onboarding_tasks')
    .select('onboarding_id, done')
    .in('onboarding_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

  const countMap: Record<string, { total: number; done: number }> = {}
  for (const t of tasks ?? []) {
    if (!t.onboarding_id) continue
    if (!countMap[t.onboarding_id]) countMap[t.onboarding_id] = { total: 0, done: 0 }
    countMap[t.onboarding_id].total += 1
    if (t.done) countMap[t.onboarding_id].done += 1
  }

  const enriched = (onboardings ?? []).map((o) => ({
    ...o,
    task_count: countMap[o.id]?.total ?? 0,
    task_done_count: countMap[o.id]?.done ?? 0,
  }))

  return NextResponse.json({ onboardings: enriched })
}

// POST /api/team/onboarding
// Creates a new onboarding, seeds the default checklist tasks, and fires the
// Discord welcome message (ready to copy/paste into WhatsApp).
export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.candidate_name || typeof body.candidate_name !== 'string' || !body.candidate_name.trim()) {
    return NextResponse.json({ error: 'candidate_name is required' }, { status: 400 })
  }

  const role = (body.role as string) || 'cold_caller'
  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }

  // Position new cards at the end of the "Applied" column.
  const { count } = await supabase
    .from('staff_onboardings')
    .select('id', { count: 'exact', head: true })
    .eq('stage', 'applied')

  const { data: onboarding, error } = await supabase
    .from('staff_onboardings')
    .insert({
      candidate_name: (body.candidate_name as string).trim(),
      role,
      team_member_id: body.team_member_id ?? null,
      stage: 'applied',
      position: count ?? 0,
      welcome_sent: true,
    })
    .select()
    .single()

  if (error || !onboarding) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })

  const seedRows = DEFAULT_ONBOARDING_TASKS.map((t, i) => ({
    onboarding_id: onboarding.id,
    title: t.title,
    category: t.category,
    url: t.url,
    position: i,
  }))
  const { error: seedError } = await supabase.from('staff_onboarding_tasks').insert(seedRows)
  if (seedError) {
    // Onboarding row exists but checklist failed to seed — surface it rather
    // than silently leaving an onboarding with zero tasks.
    return NextResponse.json({ error: `Onboarding created but checklist seed failed: ${seedError.message}` }, { status: 500 })
  }

  notifyStaffWelcome(onboarding.candidate_name ?? 'New hire', onboarding.role)

  return NextResponse.json({ onboarding }, { status: 201 })
}
