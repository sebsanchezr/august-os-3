import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(req.url)

  const dealId = searchParams.get('deal_id')
  const status = searchParams.get('status')
  const owner = searchParams.get('owner')
  const callType = searchParams.get('call_type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('sales_calls')
    .select(`
      *,
      pipeline_deals(id, prospect_name, company, stage),
      profiles:owner_profile_id(id, name)
    `)

  if (dealId) query = query.eq('deal_id', dealId)
  if (status) query = query.eq('status', status)
  if (owner) query = query.eq('owner_profile_id', owner)
  if (callType) query = query.eq('call_type', callType)
  if (from) query = query.gte('scheduled_at', from)
  if (to) query = query.lte('scheduled_at', to)

  query = query.order('scheduled_at', { ascending: false }).limit(100)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sales_calls: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdmin()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.deal_id) {
    return NextResponse.json({ error: 'deal_id is required' }, { status: 400 })
  }

  const callType = (body.call_type as string) || 'discovery'
  const sequence = (body.sequence as number) || 1

  const { data: call, error } = await supabase
    .from('sales_calls')
    .insert({
      deal_id: body.deal_id,
      call_type: callType,
      sequence,
      status: body.status ?? 'scheduled',
      scheduled_at: body.scheduled_at ?? null,
      owner_profile_id: body.owner_profile_id ?? null,
      deck_url: body.deck_url ?? null,
      recording_url: body.recording_url ?? null,
    })
    .select()
    .single()

  if (error || !call) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  return NextResponse.json({ sales_call: call }, { status: 201 })
}
