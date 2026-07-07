import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

const CREATIVE_STATUSES = ['brief', 'editing', 'revision', 'approved_by_client', 'sent_to_media_buyer', 'live'] as const
const OPS_STATUSES = ['brief', 'in_progress', 'review', 'completed'] as const
const TRACKS = ['creative', 'ops'] as const
const DEPARTMENTS = ['creative', 'paid_ads', 'client', 'company', 'admin', 'ceo'] as const
const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const
const SOURCES = ['manual', 'meeting', 'agent', 'recurring'] as const

type Track = typeof TRACKS[number]

function validStatusForTrack(track: Track, status: string): boolean {
  if (track === 'creative') return (CREATIVE_STATUSES as readonly string[]).includes(status)
  return (OPS_STATUSES as readonly string[]).includes(status)
}

function isTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'live'
}

// GET /api/tasks
// Filters: track, status, assignee_id, department, client_id, include_archived, include_deleted
export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(req.url)

  const track = searchParams.get('track')
  const status = searchParams.get('status')
  const assigneeId = searchParams.get('assignee_id')
  const department = searchParams.get('department')
  const clientId = searchParams.get('client_id')
  const includeArchived = searchParams.get('include_archived') === 'true'
  const includeDeleted = searchParams.get('include_deleted') === 'true'

  let query = supabase
    .from('tasks')
    .select(`
      *,
      profiles!tasks_assignee_id_fkey(id, name, role),
      creator:profiles!tasks_created_by_fkey(id, name),
      clients(id, name, status)
    `)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  if (!includeDeleted) query = query.is('deleted_at', null)
  if (!includeArchived) query = query.is('archived_at', null)
  if (track) query = query.eq('track', track)
  if (status) query = query.eq('status', status)
  if (assigneeId) query = query.eq('assignee_id', assigneeId)
  if (department) query = query.eq('department', department)
  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data ?? [] })
}

// POST /api/tasks
export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const track = (body.track as string) || 'ops'
  const status = (body.status as string) || 'brief'
  const department = (body.department as string) || 'admin'
  const priority = (body.priority as string) || 'normal'
  const source = (body.source as string) || 'manual'

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!(TRACKS as readonly string[]).includes(track)) {
    return NextResponse.json({ error: `track must be one of: ${TRACKS.join(', ')}` }, { status: 400 })
  }
  if (!validStatusForTrack(track as Track, status)) {
    const valid = track === 'creative' ? CREATIVE_STATUSES : OPS_STATUSES
    return NextResponse.json({ error: `status must be one of: ${valid.join(', ')} for track=${track}` }, { status: 400 })
  }
  if (!(DEPARTMENTS as readonly string[]).includes(department)) {
    return NextResponse.json({ error: `department must be one of: ${DEPARTMENTS.join(', ')}` }, { status: 400 })
  }
  if (!(PRIORITIES as readonly string[]).includes(priority)) {
    return NextResponse.json({ error: `priority must be one of: ${PRIORITIES.join(', ')}` }, { status: 400 })
  }
  if (track === 'client' && !body.client_id) {
    return NextResponse.json({ error: 'client_id is required for department=client' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const completedAt = isTerminalStatus(status) ? now : null

  const { data: task, error: insertErr } = await supabase
    .from('tasks')
    .insert({
      title: (body.title as string).trim(),
      description: (body.description as string) || '',
      track,
      department,
      client_id: body.client_id || null,
      assignee_id: body.assignee_id || null,
      created_by: body.created_by || null,
      status,
      priority,
      due_date: body.due_date || null,
      blocked_reason: body.blocked_reason || null,
      source,
      meeting_ref: body.meeting_ref || null,
      recurrence: body.recurrence || null,
      tags: body.tags || [],
      position: body.position || 0,
      completed_at: completedAt,
    })
    .select()
    .single()

  if (insertErr || !task) return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })

  await supabase.from('task_events').insert({
    task_id: task.id,
    actor_id: body.created_by || null,
    type: 'created',
    payload: { title: task.title, track, status, department, source },
    occurred_at: now,
  })

  return NextResponse.json({ task }, { status: 201 })
}
