import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const campaign = req.nextUrl.searchParams.get('campaign')
  const leadId = req.nextUrl.searchParams.get('lead_id')

  let query = supabase
    .from('ce_events')
    .select('id, type, payload, occurred_at, lead_id, ce_leads(email, first_name, last_name, company, campaign)')
    .order('occurred_at', { ascending: false })
    .limit(100)

  if (leadId) query = query.eq('lead_id', leadId)
  if (campaign) query = query.eq('ce_leads.campaign', campaign)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // filter by campaign if needed (foreign table filter may not work as expected)
  const events = campaign
    ? (data ?? []).filter((e: any) => e.ce_leads?.campaign === campaign)
    : (data ?? [])

  return NextResponse.json({ events })
}
