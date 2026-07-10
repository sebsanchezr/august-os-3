import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/upwork?status=surfaced|applied|replied|call_booked|won|passed|all
export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'all'

  let query = supabase
    .from('upwork_jobs')
    .select('*, upwork_proposals(*), upwork_messages(*)')

  if (status !== 'all') query = query.eq('status', status)

  query = query.order('created_at', { ascending: false }).limit(100)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data ?? [] })
}
