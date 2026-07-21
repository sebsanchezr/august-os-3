import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// PATCH /api/team/onboarding/[id]/tasks/[taskId]
// Toggles (or explicitly sets) a checklist item's done state.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; taskId: string } },
) {
  const supabase = createSupabaseAdmin()
  const { id, taskId } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (typeof body.done !== 'boolean') {
    return NextResponse.json({ error: 'done (boolean) is required' }, { status: 400 })
  }

  const { data: task, error } = await supabase
    .from('staff_onboarding_tasks')
    .update({ done: body.done })
    .eq('id', taskId)
    .eq('onboarding_id', id)
    .select()
    .single()

  if (error || !task) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  return NextResponse.json({ task })
}
