import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/pending-tasks
// Session-authenticated (see middleware.ts). Returns meeting-extracted task
// suggestions still awaiting a human decision, newest first. Consumed by the
// "Meeting tasks pending approval" section on /accounts/approvals.
export async function GET() {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase
    .from('pending_meeting_tasks')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pending_tasks: data ?? [] })
}
