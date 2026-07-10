import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// POST /api/comms/[id]/respond
// One-tap: marks a comms_log entry as responded now.
// Body: { responded_by?: uuid } (optional, for logging)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { body = {} }

  const { data: existing } = await supabase
    .from('client_comms_log')
    .select('id, requires_response, responded_at')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Comm not found' }, { status: 404 })
  if (!existing.requires_response) return NextResponse.json({ error: 'This comm has no response clock' }, { status: 422 })
  if (existing.responded_at) return NextResponse.json({ error: 'Already marked as responded' }, { status: 422 })

  const now = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from('client_comms_log')
    .update({ responded_at: now })
    .eq('id', id)
    .select()
    .single()

  if (error || !updated) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  return NextResponse.json({ comm: updated })
}
