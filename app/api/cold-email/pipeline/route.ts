import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const VALID_STAGES = [
  'new_reply', 'qualified', 'creatives_in_production', 'creatives_delivered',
  'call_booked', 'showed', 'proposal', 'won', 'lost', 'nurture',
] as const

type Stage = typeof VALID_STAGES[number]

export async function GET() {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase
    .from('ce_pipeline')
    .select('*, ce_leads(id, email, first_name, last_name, company, website, niche, source, campaign, quality_score, status, created_at)')
    .order('stage_entered_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pipeline: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  let body: { id: string; stage: Stage }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.id || !VALID_STAGES.includes(body.stage)) {
    return NextResponse.json({ error: 'id and valid stage required' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { data: row, error: fetchErr } = await supabase
    .from('ce_pipeline')
    .select('stage, lead_id')
    .eq('id', body.id)
    .single()

  if (fetchErr || !row) return NextResponse.json({ error: 'Pipeline row not found' }, { status: 404 })

  const prevStage = row.stage

  const { error: updateErr } = await supabase
    .from('ce_pipeline')
    .update({ stage: body.stage, stage_entered_at: now })
    .eq('id', body.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Insert stage_change event
  await supabase.from('ce_events').insert({
    lead_id: row.lead_id,
    type: 'stage_change',
    payload: { from: prevStage, to: body.stage },
    occurred_at: now,
  })

  return NextResponse.json({ ok: true })
}
