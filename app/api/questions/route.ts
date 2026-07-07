import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyTeamQuestion } from '@/lib/discord-notify'

// GET /api/questions?status=open|answered|expired|all
export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'open'

  let query = supabase
    .from('team_questions')
    .select('*, clients(id, name), asker:profiles!team_questions_asked_by_fkey(id, name), target:profiles!team_questions_target_profile_id_fkey(id, name), answerer:profiles!team_questions_answered_by_fkey(id, name)')

  if (status !== 'all') query = query.eq('status', status)

  query = query.order('asked_at', { ascending: false }).limit(100)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data ?? [] })
}

// POST /api/questions
// Create a question, post to Discord via the notify helper.
export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdmin()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.question || typeof body.question !== 'string' || !body.question.trim()) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }

  const { data: question, error } = await supabase
    .from('team_questions')
    .insert({
      question:          (body.question as string).trim(),
      context:           (body.context as string)?.trim() ?? '',
      client_id:         body.client_id ?? null,
      meeting_id:        body.meeting_id ?? null,
      task_id:           body.task_id ?? null,
      asked_by:          body.asked_by ?? null,
      target_profile_id: body.target_profile_id ?? null,
      status:            'open',
    })
    .select('*, clients(id, name), asker:profiles!team_questions_asked_by_fkey(id, name), target:profiles!team_questions_target_profile_id_fkey(id, name)')
    .single()

  if (error || !question) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })

  // Fire Discord notification
  notifyTeamQuestion(
    { id: question.id, question: question.question, context: question.context },
    question.clients ?? null,
    question.asker ?? null,
    question.target ?? null,
  )

  return NextResponse.json({ question }, { status: 201 })
}
