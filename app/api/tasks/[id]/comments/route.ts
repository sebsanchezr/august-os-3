import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyComment } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// POST /api/tasks/[id]/comments
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params
  let body: { body: string; author_id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.body || !body.body.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  // Verify task exists and is not deleted
  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .select('id, deleted_at')
    .eq('id', id)
    .single()

  if (taskErr || !task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (task.deleted_at) return NextResponse.json({ error: 'Cannot comment on a deleted task' }, { status: 400 })

  const now = new Date().toISOString()

  const { data: comment, error: insertErr } = await supabase
    .from('task_comments')
    .insert({ task_id: id, author_id: body.author_id || null, body: body.body.trim() })
    .select('*, profiles!task_comments_author_id_fkey(id, name)')
    .single()

  if (insertErr || !comment) return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })

  await supabase.from('task_events').insert({
    task_id: id,
    actor_id: body.author_id || null,
    type: 'commented',
    payload: { comment_id: comment.id, preview: body.body.slice(0, 80) },
    occurred_at: now,
  })

  // Notify task owner if commenter is someone else
  const { data: enriched } = await supabase
    .from('tasks')
    .select('*, profiles!tasks_assignee_id_fkey(id, name, discord_user_id), creator:profiles!tasks_created_by_fkey(id, name, discord_user_id), clients(id, name)')
    .eq('id', id)
    .single()

  if (enriched) {
    const commenterName = comment.profiles?.name ?? 'Someone'
    const owner = enriched.creator ?? enriched.profiles ?? null
    if (owner && owner.id !== body.author_id) {
      notifyComment(enriched, commenterName, body.body, owner)
    }
  }

  return NextResponse.json({ comment }, { status: 201 })
}
