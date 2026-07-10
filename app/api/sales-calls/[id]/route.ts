import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { PipelineStage } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { data, error } = await supabase
    .from('sales_calls')
    .select(`
      *,
      pipeline_deals(id, prospect_name, company, stage, mrr_value, currency),
      profiles:owner_profile_id(id, name)
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ sales_call: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const allowed = [
    'status', 'call_type', 'scheduled_at', 'held_at', 'duration_minutes',
    'owner_profile_id', 'recording_url', 'deck_url', 'transcript', 'outcome',
    'next_step', 'next_step_due', 'notes', 'analysis',
  ]

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (body.held_at && !patch.held_at) {
    patch.held_at = new Date().toISOString()
    patch.status = 'held'
  }

  if (body.outcome) {
    const outcome = body.outcome as string
    const { data: call, error: fetchError } = await supabase
      .from('sales_calls')
      .select('deal_id')
      .eq('id', id)
      .single()

    if (!fetchError && call) {
      let dealStage: PipelineStage | undefined

      if (outcome === 'won') dealStage = 'won'
      else if (outcome === 'lost') dealStage = 'lost'
      else if (outcome === 'advanced') dealStage = 'proposal'

      if (dealStage) {
        await supabase
          .from('pipeline_deals')
          .update({ stage: dealStage, updated_at: new Date().toISOString() })
          .eq('id', call.deal_id)
      }
    }
  }

  const { data, error } = await supabase
    .from('sales_calls')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sales_call: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { error } = await supabase.from('sales_calls').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
