import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

// POST /api/pending-tasks/[id]/approve
// Session-authenticated. Reads the pending_meeting_tasks row, creates the
// real task in `tasks` using the same field mapping meeting_agent.py used to
// send to /api/tasks/inbound, then marks the pending row approved.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { data: pending, error: fetchErr } = await supabase
    .from('pending_meeting_tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !pending) return NextResponse.json({ error: 'Pending task not found' }, { status: 404 })
  if (pending.status !== 'pending') {
    return NextResponse.json({ error: `Pending task is already ${pending.status}` }, { status: 422 })
  }

  const department = pending.suggested_department || 'admin'
  const track = department === 'creative' ? 'creative' : 'ops'
  const meetingTitle = pending.meeting_title || ''
  const now = new Date().toISOString()

  // Best-effort match of the suggested client name to a real client_id.
  let clientId: string | null = null
  if (pending.suggested_client_name) {
    const { data: clientMatch } = await supabase
      .from('clients')
      .select('id')
      .ilike('name', pending.suggested_client_name)
      .limit(1)
      .maybeSingle()
    clientId = clientMatch?.id ?? null
  }

  const { data: task, error: insertErr } = await supabase
    .from('tasks')
    .insert({
      title: pending.title,
      description: pending.quote || pending.description || '',
      track,
      department,
      client_id: clientId,
      status: 'brief',
      priority: 'normal',
      source: 'meeting',
      meeting_ref: pending.source_file_id || null,
      tags: meetingTitle ? [meetingTitle.slice(0, 40)] : [],
      position: 0,
    })
    .select()
    .single()

  if (insertErr || !task) return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })

  await supabase.from('task_events').insert({
    task_id: task.id,
    actor_id: null,
    type: 'created',
    payload: { source: 'meeting', meeting_ref: pending.source_file_id || null, title: task.title, pending_task_id: pending.id },
    occurred_at: now,
  })

  const { data: updatedPending, error: updateErr } = await supabase
    .from('pending_meeting_tasks')
    .update({ status: 'approved', reviewed_at: now })
    .eq('id', id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ task, pending_task: updatedPending })
}
