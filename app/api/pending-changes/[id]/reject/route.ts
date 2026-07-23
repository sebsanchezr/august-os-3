import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// POST /api/pending-changes/[id]/reject
// Body: { rejection_note?: string }
// Marks a staged proposal rejected. Nothing is written to the live tables.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { body = {} }

  const { data: change } = await supabase
    .from('pending_changes')
    .select('status')
    .eq('id', id)
    .single()

  if (!change) return NextResponse.json({ error: 'Change not found' }, { status: 404 })
  if (change.status !== 'pending') {
    return NextResponse.json({ error: `Change is already ${change.status}` }, { status: 422 })
  }

  const { data: updated, error } = await supabase
    .from('pending_changes')
    .update({
      status: 'rejected',
      rejection_note: (body.rejection_note as string)?.trim() ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error || !updated) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  return NextResponse.json({ change: updated })
}
