import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/creatives/suggestions?client_id=...
// Returns active, data-grounded "make this next" creative suggestions for the
// client, highest priority first. Populated by the winning-ad analysis flow
// (execution/creative_suggestions.py). Shown in the Create Creative Batch panel.
export async function GET(req: NextRequest) {
  const client_id = req.nextUrl.searchParams.get('client_id')
  if (!client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('creative_suggestions')
    .select('id, title, angle, format, rationale, evidence, priority')
    .eq('client_id', client_id)
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .limit(8)
  if (error) {
    if (error.code === '42P01') return NextResponse.json({ suggestions: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ suggestions: data ?? [] })
}
