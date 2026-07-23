import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/pending-changes?status=pending
// Lists staged proposals (tasks / issues / health / weekly_focus) the Mac
// reporter extracted from call transcripts, with their client, newest first.
export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const status = req.nextUrl.searchParams.get('status') ?? 'pending'

  const { data, error } = await supabase
    .from('pending_changes')
    .select('*, clients(id, name, health)')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ changes: data ?? [] })
}
