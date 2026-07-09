import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { isMissingTableError, weekStartOf, MIGRATION_MISSING_MESSAGE } from '@/lib/creatives'
import { draftCreativeStrategy } from '@/lib/creatives-server'

// POST /api/creatives/strategy: draft this week's creative strategy for a client.
// Body: { client_id, focus, notes? }
// Gathers client context, last 14 days of metrics, and recent knowledge_base
// research, then asks Claude for a compact static-ads strategy. Upserts a
// draft row into creative_strategies for the current week.
export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdmin()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const client_id = body.client_id as string
  const focus = (body.focus as string)?.trim()
  const notes = (body.notes as string)?.trim() || null

  if (!client_id || !focus) {
    return NextResponse.json({ error: 'client_id and focus are required' }, { status: 400 })
  }

  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .select('name, services, notes, target_roas, target_cpa')
    .eq('id', client_id)
    .single()

  if (clientError || !clientRow) {
    return NextResponse.json({ error: clientError?.message ?? 'Client not found' }, { status: 404 })
  }

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: metrics } = await supabase
    .from('client_metrics_daily')
    .select('date, spend, revenue, roas, purchases, cpa')
    .eq('client_id', client_id)
    .gte('date', fourteenDaysAgo)
    .order('date', { ascending: false })

  const { data: knowledge } = await supabase
    .from('knowledge_base')
    .select('title, content')
    .order('ingested_at', { ascending: false })
    .limit(3)

  let strategy_md: string
  try {
    strategy_md = await draftCreativeStrategy({
      clientContext: {
        name: clientRow.name,
        services: clientRow.services,
        notes: clientRow.notes,
        target_roas: clientRow.target_roas,
        target_cpa: clientRow.target_cpa,
      },
      focus,
      notes,
      metrics: metrics ?? [],
      knowledge: knowledge ?? [],
    })
  } catch (err) {
    return NextResponse.json({ error: `AI drafting failed: ${(err as Error).message}` }, { status: 502 })
  }

  const week_start = weekStartOf()

  const { data, error } = await supabase
    .from('creative_strategies')
    .upsert(
      { client_id, week_start, focus, strategy_md, status: 'draft', approved_at: null },
      { onConflict: 'client_id,week_start' }
    )
    .select('*')
    .single()

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: MIGRATION_MISSING_MESSAGE }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ strategy: data })
}
