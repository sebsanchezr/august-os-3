import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { ASSET_KINDS, isMissingTableError, weekStartOf, MIGRATION_MISSING_MESSAGE } from '@/lib/creatives'
import type { AssetKind } from '@/lib/creatives'

export const dynamic = 'force-dynamic'

// GET /api/creatives?scope=assets|strategies|clients
// - assets: every creative library link, joined with client name.
// - strategies: current week's strategy row (if any) per non-archived client.
// - clients: non-archived clients for the form dropdowns.
export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const scope = req.nextUrl.searchParams.get('scope') ?? 'assets'

  if (scope === 'clients') {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, services')
      .is('archived_at', null)
      .order('name', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ clients: data ?? [] })
  }

  if (scope === 'strategies') {
    const weekStart = weekStartOf()

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, services')
      .is('archived_at', null)
      .order('name', { ascending: true })
    if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 })

    const { data: strategies, error: strategiesError } = await supabase
      .from('creative_strategies')
      .select('*')
      .eq('week_start', weekStart)
    if (strategiesError) {
      if (isMissingTableError(strategiesError)) {
        return NextResponse.json({ error: MIGRATION_MISSING_MESSAGE }, { status: 409 })
      }
      return NextResponse.json({ error: strategiesError.message }, { status: 500 })
    }

    const byClient = new Map((strategies ?? []).map(s => [s.client_id, s]))
    const items = (clients ?? []).map(c => ({ client: c, strategy: byClient.get(c.id) ?? null }))

    return NextResponse.json({ weekStart, items })
  }

  if (scope === 'outputs') {
    const { data, error } = await supabase
      .from('creative_strategy_outputs')
      .select('*, client:clients(id, name)')
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({ error: 'Run migration 035 to enable creative outputs.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ outputs: data ?? [] })
  }

  // scope === 'assets'
  const { data, error } = await supabase
    .from('client_creative_assets')
    .select('*, client:clients(id, name)')
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: MIGRATION_MISSING_MESSAGE }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ assets: data ?? [] })
}

// POST /api/creatives: add a creative library link.
// Body: { client_id, title, kind, url, notes }
export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdmin()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const client_id = body.client_id as string
  const title = (body.title as string)?.trim()
  const kind = (body.kind as AssetKind) ?? 'drive'
  const url = (body.url as string)?.trim() || null
  const notes = (body.notes as string)?.trim() || null

  if (!client_id || !title) {
    return NextResponse.json({ error: 'client_id and title are required' }, { status: 400 })
  }
  if (!ASSET_KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind must be one of: ${ASSET_KINDS.join(', ')}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_creative_assets')
    .insert({ client_id, title, kind, url, notes })
    .select('*, client:clients(id, name)')
    .single()

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: MIGRATION_MISSING_MESSAGE }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ asset: data })
}

// DELETE /api/creatives?id=...: remove a creative library link.
export async function DELETE(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 })

  const { error } = await supabase.from('client_creative_assets').delete().eq('id', id)

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: MIGRATION_MISSING_MESSAGE }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
