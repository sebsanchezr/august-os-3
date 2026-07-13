import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

// POST /api/pending-tasks/[id]/reject
// Session-authenticated. Marks a pending meeting-task suggestion rejected --
// nothing is created in the real `tasks` table.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { data: pending, error: fetchErr } = await supabase
    .from('pending_meeting_tasks')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchErr || !pending) return NextResponse.json({ error: 'Pending task not found' }, { status: 404 })
  if (pending.status !== 'pending') {
    return NextResponse.json({ error: `Pending task is already ${pending.status}` }, { status: 422 })
  }

  const { data: updated, error } = await supabase
    .from('pending_meeting_tasks')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !updated) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  return NextResponse.json({ pending_task: updated })
}
