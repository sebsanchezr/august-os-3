import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = ['update', 'milestone', 'payment', 'status_change', 'issue', 'note'] as const

// GET /api/accounts/[id]/history
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { data, error } = await supabase
    .from('client_history')
    .select('*')
    .eq('client_id', id)
    .order('occurred_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ history: data ?? [] })
}

// POST /api/accounts/[id]/history
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const category = (body.category as string) || 'update'
  if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 })
  }

  const detail = typeof body.detail === 'string' && body.detail.trim() ? body.detail.trim() : null
  const occurredAt = (body.occurred_at as string) || new Date().toISOString()
  const createdBy = typeof body.created_by === 'string' && body.created_by.trim() ? body.created_by.trim() : 'Seb'

  const { data: entry, error } = await supabase
    .from('client_history')
    .insert({
      client_id:   id,
      category,
      title,
      detail,
      occurred_at: occurredAt,
      created_by:  createdBy,
    })
    .select()
    .single()

  if (error || !entry) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  return NextResponse.json({ entry }, { status: 201 })
}
