import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

// GET /api/accounts/[id]/talking-points
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { searchParams } = new URL(_req.url)
  const unconsumedOnly = searchParams.get('unconsumed') === 'true'

  let query = supabase
    .from('client_talking_points')
    .select('*, adder:profiles!client_talking_points_added_by_fkey(id, name)')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  if (unconsumedOnly) query = query.is('consumed_by_report', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ talking_points: data ?? [] })
}

// POST /api/accounts/[id]/talking-points
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.point || typeof body.point !== 'string' || !body.point.trim()) {
    return NextResponse.json({ error: 'point is required' }, { status: 400 })
  }

  const { data: tp, error } = await supabase
    .from('client_talking_points')
    .insert({
      client_id: id,
      point:     (body.point as string).trim(),
      added_by:  body.added_by ?? null,
    })
    .select()
    .single()

  if (error || !tp) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  return NextResponse.json({ talking_point: tp }, { status: 201 })
}
