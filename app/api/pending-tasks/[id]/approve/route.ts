import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

// POST /api/pending-tasks/[id]/approve
// Session-authenticated. Reads the pending_meeting_tasks row, creates the
// real task in `tasks`, and — this is the enrichment — resolves the agent's
// suggestions (suggested_assignee_role, due_hint) into concrete fields so the
// task doesn't land unassigned with no due date. Then marks the pending row
// approved.

// Turn a fuzzy due_hint ("next week", "friday", "in 3 days") into a YYYY-MM-DD.
// Unparseable hints return null rather than guessing.
function resolveDueDate(hint: string | null | undefined): string | null {
  if (!hint) return null
  const h = hint.trim().toLowerCase()
  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const addDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d }
  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  if (/\b(today|eod|end of day|asap|now)\b/.test(h)) return iso(today)
  if (/\btomorrow\b/.test(h)) return iso(addDays(1))
  const inDays = h.match(/\bin (\d+) days?\b/)
  if (inDays) return iso(addDays(parseInt(inDays[1], 10)))
  if (/\b(this week|end of week|eow|by friday)\b/.test(h)) {
    const delta = (5 - today.getDay() + 7) % 7   // upcoming Friday (today if already Fri)
    return iso(addDays(delta))
  }
  if (/\bnext week\b/.test(h)) {
    const delta = ((1 - today.getDay() + 7) % 7) || 7   // next Monday
    return iso(addDays(delta))
  }
  if (/\bend of month\b/.test(h)) return iso(new Date(today.getFullYear(), today.getMonth() + 1, 0))
  if (/\bnext month\b/.test(h)) return iso(new Date(today.getFullYear(), today.getMonth() + 2, 0))
  // Named weekday → its next occurrence
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(h)) {
      const delta = ((i - today.getDay() + 7) % 7) || 7
      return iso(addDays(delta))
    }
  }
  return null
}

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

  // Best-effort match of the suggested client name to a real client (+ its AM).
  let clientId: string | null = null
  let clientAm: string | null = null
  if (pending.suggested_client_name) {
    const { data: clientMatch } = await supabase
      .from('clients')
      .select('id, am_profile_id')
      .ilike('name', pending.suggested_client_name)
      .limit(1)
      .maybeSingle()
    clientId = clientMatch?.id ?? null
    clientAm = clientMatch?.am_profile_id ?? null
  }

  // Resolve an assignee from the agent's suggested role:
  //  - account-manager work → the client's own AM if it has one, else any AM
  //  - other roles (media_buyer, editor, …) → first active profile with that role
  //  - last resort → the client's AM (so client work never lands fully orphaned)
  const role: string | null = pending.suggested_assignee_role || null
  let assigneeId: string | null = null
  if (role) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, role, active')
    const byRole = (r: string) => profiles?.find((p) => p.role === r && p.active !== false)?.id ?? null
    if (role === 'account_manager') {
      assigneeId = clientAm ?? byRole('account_manager')
    } else {
      assigneeId = byRole(role)
    }
  }
  if (!assigneeId) assigneeId = clientAm

  const dueDate = resolveDueDate(pending.due_hint)

  const { data: task, error: insertErr } = await supabase
    .from('tasks')
    .insert({
      title: pending.title,
      description: pending.quote || pending.description || '',
      track,
      department,
      client_id: clientId,
      assignee_id: assigneeId,
      due_date: dueDate,
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
    payload: {
      source: 'meeting',
      meeting_ref: pending.source_file_id || null,
      title: task.title,
      pending_task_id: pending.id,
      auto_assignee_id: assigneeId,
      auto_due_date: dueDate,
    },
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
