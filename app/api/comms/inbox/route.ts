import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/comms/inbox
// All open response clocks across all clients, ordered by due soonest.
// Also returns team_questions (open, ordered by asked_at ASC).
export async function GET(_req: NextRequest) {
  const supabase = createSupabaseAdmin()

  const [commsResult, questionsResult] = await Promise.all([
    supabase
      .from('client_comms_log')
      .select('*, clients(id, name, health, am_profile_id), logger:profiles!client_comms_log_logged_by_fkey(id, name)')
      .eq('requires_response', true)
      .is('responded_at', null)
      .order('response_due_at', { ascending: true })
      .limit(100),
    supabase
      .from('team_questions')
      .select('*, clients(id, name), asker:profiles!team_questions_asked_by_fkey(id, name), target:profiles!team_questions_target_profile_id_fkey(id, name), answerer:profiles!team_questions_answered_by_fkey(id, name)')
      .in('status', ['open', 'answered'])
      .order('asked_at', { ascending: false })
      .limit(50),
  ])

  if (commsResult.error) return NextResponse.json({ error: commsResult.error.message }, { status: 500 })
  if (questionsResult.error) return NextResponse.json({ error: questionsResult.error.message }, { status: 500 })

  return NextResponse.json({
    open_clocks: commsResult.data ?? [],
    questions:   questionsResult.data ?? [],
  })
}
