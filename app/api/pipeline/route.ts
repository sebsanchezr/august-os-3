import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const VALID_CHANNELS = ['cold_call', 'cold_email', 'linkedin', 'gov', 'referral', 'expansion', 'other'] as const
const VALID_STAGES = ['new', 'contacted', 'positive_reply', 'booked', 'showed', 'proposal', 'won', 'lost'] as const

// GET /api/pipeline?stage=&channel=
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const stage = searchParams.get('stage')
    const channel = searchParams.get('channel')

    let query = supabase
      .from('pipeline_deals')
      .select('*, owner:profiles!pipeline_deals_owner_profile_id_fkey(id, name)')
      .order('expected_close', { ascending: true, nullsFirst: false })

    if (stage) query = query.eq('stage', stage)
    if (channel) query = query.eq('source_channel', channel)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ deals: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[pipeline/route GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/pipeline
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prospect_name, source_channel, stage } = body

    if (!prospect_name || typeof prospect_name !== 'string') {
      return NextResponse.json({ error: 'prospect_name is required' }, { status: 400 })
    }
    if (!source_channel || !VALID_CHANNELS.includes(source_channel)) {
      return NextResponse.json({ error: `source_channel must be one of: ${VALID_CHANNELS.join(', ')}` }, { status: 400 })
    }
    if (stage !== undefined && !VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: `stage must be one of: ${VALID_STAGES.join(', ')}` }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('pipeline_deals')
      .insert({
        prospect_name,
        company: body.company ?? null,
        source_channel,
        stage: stage ?? 'new',
        mrr_value: body.mrr_value ?? 0,
        setup_value: body.setup_value ?? 0,
        probability: body.probability ?? 0,
        currency: body.currency ?? 'GBP',
        expected_close: body.expected_close ?? null,
        owner_profile_id: body.owner_profile_id ?? null,
        next_action: body.next_action ?? null,
        next_action_due: body.next_action_due ?? null,
        notes: body.notes ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ deal: data }, { status: 201 })
  } catch (err) {
    console.error('[pipeline/route POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
