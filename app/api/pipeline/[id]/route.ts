import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyDealWon, notifyDealLost } from '@/lib/discord-notify'
import { VALID_CHANNELS } from '@/lib/pipeline-constants'

export const dynamic = 'force-dynamic'

const VALID_STAGES = ['new', 'contacted', 'positive_reply', 'booked', 'showed', 'proposal', 'won', 'lost'] as const

// GET /api/pipeline/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('pipeline_deals')
      .select('*, owner:profiles!pipeline_deals_owner_profile_id_fkey(id, name)')
      .eq('id', params.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ deal: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[pipeline/[id]/route GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/pipeline/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()

    if (body.source_channel !== undefined && !VALID_CHANNELS.includes(body.source_channel)) {
      return NextResponse.json({ error: `source_channel must be one of: ${VALID_CHANNELS.join(', ')}` }, { status: 400 })
    }
    if (body.stage !== undefined && !VALID_STAGES.includes(body.stage)) {
      return NextResponse.json({ error: `stage must be one of: ${VALID_STAGES.join(', ')}` }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()

    // Stage gates: a deal cannot be marked won without a value, or lost without a reason.
    // Mirrors the root-cause enforcement pattern on accounts/issues/[id].
    if (body.stage === 'won') {
      const { data: current } = await supabase.from('pipeline_deals').select('mrr_value').eq('id', params.id).single()
      const mrr = body.mrr_value ?? current?.mrr_value ?? 0
      if (!mrr || mrr <= 0) {
        return NextResponse.json({ error: 'Cannot mark a deal won without an mrr_value greater than 0' }, { status: 400 })
      }
    }
    if (body.stage === 'lost' && !body.notes) {
      const { data: current } = await supabase.from('pipeline_deals').select('notes').eq('id', params.id).single()
      if (!current?.notes) {
        return NextResponse.json({ error: 'Cannot mark a deal lost without a reason in notes' }, { status: 400 })
      }
    }

    const allowedFields = [
      'prospect_name', 'company', 'source_channel', 'stage', 'mrr_value', 'setup_value',
      'probability', 'currency', 'expected_close', 'owner_profile_id', 'next_action',
      'next_action_due', 'notes',
    ] as const

    const patch: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) patch[field] = body[field]
    }

    const { data, error } = await supabase
      .from('pipeline_deals')
      .update(patch)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Won deals auto-create the client record and notify Discord.
    // Best-effort: a failure here never fails the stage move itself. Guard
    // against duplicate clients: skip the insert if a non-archived client
    // with the same name already exists.
    if (body.stage === 'won') {
      try {
        const clientName = (data.company || data.prospect_name || '').trim()
        let existingClient = null
        if (clientName) {
          const { data: found } = await supabase
            .from('clients')
            .select('id')
            .is('archived_at', null)
            .ilike('name', clientName)
            .limit(1)
            .maybeSingle()
          existingClient = found
        }
        if (!existingClient) {
          await supabase.from('clients').insert({
            name: clientName || data.company || data.prospect_name,
            status: 'active',
            mrr: data.mrr_value,
            currency: data.currency,
          })
        }
      } catch (clientErr) {
        console.error('[pipeline/[id]/route] failed to auto-create client for won deal', clientErr)
      }
      notifyDealWon(data)
    }
    if (body.stage === 'lost') {
      notifyDealLost(data, data.notes ?? 'no reason given')
    }

    return NextResponse.json({ deal: data })
  } catch (err) {
    console.error('[pipeline/[id]/route PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/pipeline/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createSupabaseAdmin()
    const { error } = await supabase.from('pipeline_deals').delete().eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[pipeline/[id]/route DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
