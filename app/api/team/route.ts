import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['cold_caller', 'sales_manager', 'other'] as const
const VALID_STATUSES = ['onboarding', 'active', 'paused', 'offboarded'] as const

// GET /api/team
// Returns all team members, most recently created first.
export async function GET(_req: NextRequest) {
  const supabase = createSupabaseAdmin()

  const { data: members, error } = await supabase
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ members: members ?? [] })
}

// POST /api/team
export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const role = (body.role as string) || 'cold_caller'
  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }

  const status = (body.status as string) || 'onboarding'
  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  const { data: member, error } = await supabase
    .from('team_members')
    .insert({
      name:              (body.name as string).trim(),
      title:             body.title ?? null,
      role,
      email:             body.email ?? null,
      phone:             body.phone ?? null,
      whatsapp:          body.whatsapp ?? null,
      location:          body.location ?? null,
      avatar_url:        body.avatar_url ?? null,
      login_email:       body.login_email ?? null,
      discord_user_id:   body.discord_user_id ?? null,
      status,
      start_date:        body.start_date ?? null,
      commission_notes:  body.commission_notes ?? null,
    })
    .select()
    .single()

  if (error || !member) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  return NextResponse.json({ member }, { status: 201 })
}
