import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServer()
  const status = req.nextUrl.searchParams.get('status')
  const source = req.nextUrl.searchParams.get('source')
  const campaign = req.nextUrl.searchParams.get('campaign')

  let query = supabase
    .from('ce_leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (source) query = query.eq('source', source)
  if (campaign) query = query.eq('campaign', campaign)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ leads: data ?? [] })
}
