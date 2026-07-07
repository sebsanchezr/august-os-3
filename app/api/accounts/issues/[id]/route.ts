import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

// PATCH /api/accounts/issues/[id]
// Enforces: resolving an issue requires root_cause AND process_fix to be present.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Fetch current state to validate resolution requirements
  const { data: existing } = await supabase
    .from('client_issues')
    .select('root_cause, process_fix, status')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

  const newStatus = (body.status as string) ?? existing.status
  const newRootCause = (body.root_cause as string | undefined) ?? existing.root_cause
  const newProcessFix = (body.process_fix as string | undefined) ?? existing.process_fix

  // Genflow enforcement: cannot mark resolved without root_cause AND process_fix
  if (newStatus === 'resolved') {
    if (!newRootCause?.trim()) {
      return NextResponse.json({ error: 'root_cause is required before resolving (Genflow: fix the process)' }, { status: 422 })
    }
    if (!newProcessFix?.trim()) {
      return NextResponse.json({ error: 'process_fix is required before resolving (Genflow: fix the process)' }, { status: 422 })
    }
  }

  const allowed = ['status', 'category', 'severity', 'description', 'root_cause', 'resolution', 'process_fix', 'owner_profile_id']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (newStatus === 'resolved' && existing.status !== 'resolved') {
    patch.resolved_at = new Date().toISOString()
  }

  const { data: issue, error } = await supabase
    .from('client_issues')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error || !issue) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  return NextResponse.json({ issue })
}

// GET /api/accounts/issues/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { data, error } = await supabase
    .from('client_issues')
    .select('*, owner:profiles!client_issues_owner_profile_id_fkey(id, name), clients(id, name)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ issue: data })
}
