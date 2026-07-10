import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/meetings
// Cross-client meetings hub. Filters: status, from, to, client_id, type.
// Default (no from/to, no status): scheduled meetings only, ordered by
// scheduled_at ASC (or done meetings for past=true), exactly as before.
//
// When a window is passed (from and/or to, used by the week-first Meetings
// page) and no explicit status filter is given, all statuses are returned
// so the page can show scheduled, done and recently cancelled meetings
// together and style each one accordingly. Passing an explicit status still
// narrows to just that status inside the window.
export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(req.url)

  const status    = searchParams.get('status')    // scheduled | done | cancelled | all
  const clientId  = searchParams.get('client_id')
  const type      = searchParams.get('type')      // weekly | monthly | adhoc
  const from      = searchParams.get('from')      // ISO date
  const to        = searchParams.get('to')        // ISO date
  const past      = searchParams.get('past') === 'true'
  const hasWindow = Boolean(from || to)

  let query = supabase
    .from('client_meetings')
    .select(`
      *,
      clients(id, name, health, am_profile_id),
      prep_report:client_reports!client_meetings_prep_report_id_fkey(id, status),
      followup_report:client_reports!client_meetings_followup_report_id_fkey(id, status)
    `)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  } else if (!status && !hasWindow) {
    query = past
      ? query.eq('status', 'done')
      : query.eq('status', 'scheduled')
  }
  // else: hasWindow with no explicit status -> no status filter, all
  // statuses within the window come back.

  if (clientId) query = query.eq('client_id', clientId)
  if (type)     query = query.eq('type', type)
  if (from)     query = query.gte('scheduled_at', from)
  if (to)       query = query.lte('scheduled_at', to)

  const asc = !past
  query = query.order('scheduled_at', { ascending: asc }).limit(200)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meetings: data ?? [] })
}
