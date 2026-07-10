import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyQuestionAnswered } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// POST /api/questions/inbound
// Called by the Discord bot when a team member replies to a question thread.
// Auth: X-Agent-Key header checked against AGENT_INBOUND_KEY env var.
// Body: {
//   discord_message_id: string   (identifies which question this answers)
//   answer: string
//   discord_user_id: string      (mapped to profiles.discord_user_id for answered_by)
// }
export async function POST(req: NextRequest) {
  const agentKey = process.env.AGENT_INBOUND_KEY
  if (!agentKey) return NextResponse.json({ error: 'Inbound API not configured' }, { status: 503 })
  if (req.headers.get('x-agent-key') !== agentKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.discord_message_id || !body.answer) {
    return NextResponse.json({ error: 'discord_message_id and answer are required' }, { status: 400 })
  }

  // Find the question by discord_message_id
  const { data: question } = await supabase
    .from('team_questions')
    .select('*, clients(id, name)')
    .eq('discord_message_id', body.discord_message_id as string)
    .eq('status', 'open')
    .single()

  if (!question) {
    return NextResponse.json({ error: 'No open question found for this Discord message' }, { status: 404 })
  }

  // Map discord_user_id to profile
  let answeredById: string | null = null
  if (body.discord_user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, discord_user_id')
      .eq('discord_user_id', body.discord_user_id as string)
      .single()
    if (profile) answeredById = profile.id
  }

  const now = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from('team_questions')
    .update({
      answer:      (body.answer as string).trim(),
      answered_by: answeredById,
      status:      'answered',
      answered_at: now,
    })
    .eq('id', question.id)
    .select('*, clients(id, name), answerer:profiles!team_questions_answered_by_fkey(id, name)')
    .single()

  if (error || !updated) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })

  // Discord confirmation
  notifyQuestionAnswered(
    { question: question.question, answer: updated.answer },
    updated.clients ?? null,
    updated.answerer ?? null,
  )

  return NextResponse.json({ question: updated })
}

// PATCH /api/questions/inbound - update discord_message_id after the bot posts
// Body: { question_id: string, discord_message_id: string }
export async function PATCH(req: NextRequest) {
  const agentKey = process.env.AGENT_INBOUND_KEY
  if (!agentKey) return NextResponse.json({ error: 'Inbound API not configured' }, { status: 503 })
  if (req.headers.get('x-agent-key') !== agentKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.question_id || !body.discord_message_id) {
    return NextResponse.json({ error: 'question_id and discord_message_id are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('team_questions')
    .update({ discord_message_id: body.discord_message_id })
    .eq('id', body.question_id as string)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  return NextResponse.json({ question: data })
}
