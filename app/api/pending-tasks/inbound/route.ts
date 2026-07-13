import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

// POST /api/pending-tasks/inbound
// Authenticated by X-Agent-Key header (set AGENT_INBOUND_KEY in env, same key
// used by /api/tasks/inbound). Used by: agents/06_meeting_tasks/meeting_agent.py
// after extracting action items from a transcript (Drive poll or Gmail poll).
//
// Body: a single object OR an array of objects:
//   {
//     meeting_id, meeting_title, source_file_id,
//     title, description, suggested_assignee_role,
//     suggested_department, suggested_client_name, due_hint, quote
//   }
//
// Writes rows with status='pending' -- nothing lands in the real `tasks`
// table until a human approves it via /api/pending-tasks/[id]/approve.

type InboundItem = {
  meeting_id?: string | null
  meeting_title?: string | null
  source_file_id?: string | null
  title: string
  description?: string
  suggested_assignee_role?: string | null
  suggested_department?: string | null
  suggested_client_name?: string | null
  due_hint?: string | null
  quote?: string | null
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

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const items: InboundItem[] = Array.isArray(body) ? body as InboundItem[] : [body as InboundItem]

  if (items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 })
  }

  const rows = []
  for (const item of items) {
    if (!item || typeof item.title !== 'string' || !item.title.trim()) {
      return NextResponse.json({ error: 'Each item requires a non-empty title' }, { status: 400 })
    }
    rows.push({
      meeting_id: item.meeting_id || null,
      meeting_title: item.meeting_title || null,
      source_file_id: item.source_file_id || null,
      title: item.title.trim(),
      description: item.description || item.quote || '',
      suggested_assignee_role: item.suggested_assignee_role || null,
      suggested_department: item.suggested_department || null,
      suggested_client_name: item.suggested_client_name || null,
      due_hint: item.due_hint || null,
      quote: item.quote || null,
      status: 'pending',
    })
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('pending_meeting_tasks')
    .insert(rows)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ pending_tasks: data ?? [] }, { status: 201 })
}
