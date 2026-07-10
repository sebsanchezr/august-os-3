import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/accounts/reports
// ?status=pending_approval  &client_id=xxx  &type=weekly_eow
export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(req.url)

  const status = searchParams.get('status')
  const clientId = searchParams.get('client_id')
  const type = searchParams.get('type')

  let query = supabase
    .from('client_reports')
    .select(`
      *,
      clients(id, name, health),
      approver:profiles!client_reports_approved_by_fkey(id, name)
    `)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (clientId) query = query.eq('client_id', clientId)
  if (type) query = query.eq('type', type)

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}
