import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyAssigned, notifySentToMediaBuyer } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

const CREATIVE_STATUSES = ['brief', 'editing', 'revision', 'approved_by_client', 'sent_to_media_buyer', 'live'] as const
const OPS_STATUSES = ['brief', 'in_progress', 'review', 'completed'] as const
const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const

function validStatusForTrack(track: string, status: string): boolean {
  if (track === 'creative') return (CREATIVE_STATUSES as readonly string[]).includes(status)
  return (OPS_STATUSES as readonly string[]).includes(status)
}

function isTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'live'
}

function nextRecurrenceDate(current: string | null, recurrence: string): string {
  const base = current ? new Date(current) : new Date()
  if (recurrence === 'daily') base.setDate(base.getDate() + 1)
  else if (recurrence === 'weekly') base.setDate(base.getDate() + 7)
  else if (recurrence === 'monthly') base.setMonth(base.getMonth() + 1)
  return base.toISOString().slice(0, 10)
}

// GET /api/tasks/[id]  -- full task with comments and recent events
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const [taskRes, commentsRes, eventsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select(`*, profiles!tasks_assignee_id_fkey(id, name, role), creator:profiles!tasks_created_by_fkey(id, name), clients(id, name)`)
      .eq('id', id)
      .single(),
    supabase
      .from('task_comments')
      .select('*, profiles!task_comments_author_id_fkey(id, name)')
      .eq('task_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('task_events')
      .select('*, profiles!task_events_actor_id_fkey(id, name)')
      .eq('task_id', id)
      .order('occurred_at', { ascending: false })
      .limit(50),
  ])

  if (taskRes.error || !taskRes.data) {
    return NextResponse.json({ error: taskRes.error?.message ?? 'Not found' }, { status: 404 })
  }

  // Second lightweight lookup: collaborator_ids is a plain uuid[] column with
  // no FK Supabase can embed. Degrades to [] if the column doesn't exist yet.
  const collaboratorIds: string[] = taskRes.data.collaborator_ids ?? []
  let collaboratorProfiles: unknown[] = []
  if (collaboratorIds.length > 0) {
    const { data: collabProfiles } = await supabase
      .from('profiles')
      .select('id, name, role')
      .in('id', collaboratorIds)
    collaboratorProfiles = collabProfiles ?? []
  }

  return NextResponse.json({
    task: { ...taskRes.data, collaborator_profiles: collaboratorProfiles },
    comments: commentsRes.data ?? [],
    events: eventsRes.data ?? [],
  })
}

// PATCH /api/tasks/[id]
// Handles: status moves, field edits, soft delete (deleted_at), restore, archive
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Fetch current task
  const { data: current, error: fetchErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !current) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const now = new Date().toISOString()
  const actorId = (body.actor_id as string) || null
  const updates: Record<string, unknown> = { updated_at: now }
  const events: Array<{ type: string; payload: Record<string, unknown> }> = []

  // Soft delete
  if (body.deleted_at === 'now' && !current.deleted_at) {
    updates.deleted_at = now
    events.push({ type: 'deleted', payload: {} })
  }

  // Restore from soft delete
  if (body.restore === true && current.deleted_at) {
    updates.deleted_at = null
    updates.archived_at = null
    events.push({ type: 'restored', payload: {} })
  }

  // Status change
  if (body.status && body.status !== current.status) {
    const newStatus = body.status as string
    if (!validStatusForTrack(current.track, newStatus)) {
      const valid = current.track === 'creative' ? CREATIVE_STATUSES : OPS_STATUSES
      return NextResponse.json({ error: `Invalid status for track=${current.track}. Valid: ${valid.join(', ')}` }, { status: 400 })
    }

    updates.status = newStatus
    if (body.blocked_reason) updates.blocked_reason = body.blocked_reason

    // Terminal status: set completed_at
    if (isTerminalStatus(newStatus) && !current.completed_at) {
      updates.completed_at = now

      // If recurring, clone a new task for the next occurrence
      if (current.recurrence) {
        const nextDue = nextRecurrenceDate(current.due_date, current.recurrence)
        const defaultStatus = 'brief'
        await supabase.from('tasks').insert({
          title: current.title,
          description: current.description,
          track: current.track,
          department: current.department,
          client_id: current.client_id,
          assignee_id: current.assignee_id,
          created_by: current.created_by,
          status: defaultStatus,
          priority: current.priority,
          due_date: nextDue,
          source: 'recurring',
          recurrence: current.recurrence,
          tags: current.tags,
          position: current.position,
        })
      }
    }

    // Leaving terminal status: clear completed_at
    if (!isTerminalStatus(newStatus) && current.completed_at) {
      updates.completed_at = null
    }

    events.push({ type: 'status_change', payload: { from: current.status, to: newStatus } })
  }

  // Assignment change
  if ('assignee_id' in body && body.assignee_id !== current.assignee_id) {
    updates.assignee_id = body.assignee_id || null
    events.push({ type: 'assigned', payload: { from: current.assignee_id, to: body.assignee_id } })
  }

  // Plain field edits
  const editableFields = ['title', 'description', 'priority', 'due_date', 'tags', 'client_id', 'position', 'meeting_ref', 'recurrence', 'collaborator_ids'] as const
  const editedFields: string[] = []
  for (const field of editableFields) {
    if (field in body && body[field] !== current[field]) {
      updates[field] = body[field]
      editedFields.push(field)
    }
  }
  if (editedFields.length > 0 && !events.find(e => e.type === 'edited')) {
    const payload: Record<string, unknown> = {}
    for (const f of editedFields) payload[f] = { from: current[f], to: body[f] }
    events.push({ type: 'edited', payload })
  }

  if (!(PRIORITIES as readonly string[]).includes(updates.priority as string) && updates.priority !== undefined) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  let { data: updated, error: updateErr } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  // Column not migrated yet: retry without collaborator_ids.
  if (updateErr?.code === '42703' && 'collaborator_ids' in updates) {
    const { collaborator_ids: _omit, ...updatesWithoutCollaborators } = updates
    ;({ data: updated, error: updateErr } = await supabase
      .from('tasks')
      .update(updatesWithoutCollaborators)
      .eq('id', id)
      .select()
      .single())
  }

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Write all events
  if (events.length > 0) {
    await supabase.from('task_events').insert(
      events.map(e => ({ task_id: id, actor_id: actorId, type: e.type, payload: e.payload, occurred_at: now }))
    )
  }

  // Discord notifications (fire-and-forget, never block the response)
  // Fetch the enriched task with client + profiles for notification context
  if (events.length > 0) {
    const { data: enriched } = await supabase
      .from('tasks')
      .select('*, profiles!tasks_assignee_id_fkey(id, name, discord_user_id), creator:profiles!tasks_created_by_fkey(id, name, discord_user_id), clients(id, name)')
      .eq('id', id)
      .single()

    if (enriched) {
      // Assignment notification
      if (events.find(e => e.type === 'assigned') && updates.assignee_id && enriched.profiles) {
        notifyAssigned(enriched, enriched.profiles)
      }

      // Sent to media buyer: ping the assignee (media buyer)
      if (
        enriched.track === 'creative' &&
        events.find(e => e.type === 'status_change' && (e.payload as Record<string,unknown>).to === 'sent_to_media_buyer')
      ) {
        notifySentToMediaBuyer(enriched, enriched.profiles ?? null)
      }
    }
  }

  return NextResponse.json({ task: updated })
}
