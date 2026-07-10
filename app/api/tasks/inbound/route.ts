import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// POST /api/tasks/inbound
// Authenticated by X-Agent-Key header (set AGENT_INBOUND_KEY in env).
// Used by: 06_meeting_tasks agent after Discord approval, future automations.
// Creates a task with source=meeting|agent and returns the created task.

const CREATIVE_STATUSES = ['brief', 'editing', 'revision', 'approved_by_client', 'sent_to_media_buyer', 'live'] as const
const OPS_STATUSES = ['brief', 'in_progress', 'review', 'completed'] as const

function validStatusForTrack(track: string, status: string): boolean {
  if (track === 'creative') return (CREATIVE_STATUSES as readonly string[]).includes(status)
  return (OPS_STATUSES as readonly string[]).includes(status)
}

export async function POST(req: NextRequest) {
  const agentKey = req.headers.get('x-agent-key')
  const expectedKey = process.env.AGENT_INBOUND_KEY

  if (!expectedKey) {
    console.error('AGENT_INBOUND_KEY not set')
    return NextResponse.json({ error: 'Inbound endpoint not configured' }, { status: 503 })
  }
  if (!agentKey || agentKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const track = (body.track as string) || 'ops'
  const status = (body.status as string) || 'brief'
  const source = (body.source as string) || 'agent'

  if (!validStatusForTrack(track, status)) {
    return NextResponse.json({ error: `Invalid status for track=${track}` }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { data: task, error: insertErr } = await supabase
    .from('tasks')
    .insert({
      title: (body.title as string).trim(),
      description: (body.description as string) || '',
      track,
      department: (body.department as string) || 'admin',
      client_id: body.client_id || null,
      assignee_id: body.assignee_id || null,
      created_by: null,
      status,
      priority: (body.priority as string) || 'normal',
      due_date: body.due_date || null,
      source,
      meeting_ref: body.meeting_ref || null,
      tags: body.tags || [],
      position: 0,
    })
    .select()
    .single()

  if (insertErr || !task) return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })

  await supabase.from('task_events').insert({
    task_id: task.id,
    actor_id: null,
    type: 'created',
    payload: { source, meeting_ref: body.meeting_ref || null, title: task.title },
    occurred_at: now,
  })

  return NextResponse.json({ task }, { status: 201 })
}
