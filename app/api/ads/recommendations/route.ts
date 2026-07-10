import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { runAdsHygiene, type HygieneCheck } from '@/lib/ads-hygiene'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const REPORT_TYPE = 'ads_recommendations'

// Optional, guarded Claude summary of the deterministic findings. Returns null
// when no ANTHROPIC_API_KEY is set (the deterministic payload still ships), or
// if the call fails. This never fabricates numbers: it only rewrites the
// findings we already computed into a short plain-English brief.
async function summariseChecks(checks: HygieneCheck[], dataAsOf: string | null): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key || checks.length === 0) return null
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const anthropic = new Anthropic({ apiKey: key })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are a senior media buyer. Below are deterministic hygiene checks already computed from ad data${dataAsOf ? ` (data as of ${dataAsOf})` : ''}. Write at most 5 short plain-English lines telling the buyer what to action first. Do not invent numbers or add strategy. Never use em-dashes.

${JSON.stringify(checks)}`,
      }],
    })
    const block = msg.content.find((b) => b.type === 'text')
    return block && block.type === 'text' ? block.text.trim() : null
  } catch {
    return null
  }
}

// GET /api/ads/recommendations?client_id=<uuid>
// Returns the most recent stored run for a client so the ads page can show the
// last checks on load without re-running.
export async function GET(req: NextRequest) {
  const clientId = new URL(req.url).searchParams.get('client_id')
  const supabase = createSupabaseAdmin()

  let query = supabase
    .from('client_reports')
    .select('id, draft_md, created_at, metrics')
    .eq('type', REPORT_TYPE)
    .order('created_at', { ascending: false })
    .limit(1)
  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query.maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const metrics = (data?.metrics ?? null) as { checks?: HygieneCheck[]; data_as_of?: string | null } | null
  const checks = Array.isArray(metrics?.checks) ? metrics!.checks : []

  return NextResponse.json({
    generated_at: data?.created_at ?? null,
    data_as_of: metrics?.data_as_of ?? null,
    checks,
    summary: data?.draft_md ?? null,
  })
}

// POST /api/ads/recommendations { client_id? }
// Runs the deterministic hygiene / miss-detection checks over the live schema
// and returns them grouped by severity. If client_id is omitted, the whole book
// is scanned. A guarded Claude summary is added only when ANTHROPIC_API_KEY is
// present. Persists per-client runs so the ads page can reload the last result.
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { /* empty body is allowed */ }
    const clientId = (body.client_id as string) || null

    const supabase = createSupabaseAdmin()
    const result = await runAdsHygiene(supabase, clientId)
    const summary = await summariseChecks(result.checks, result.data_as_of)
    const generatedAt = new Date().toISOString()

    // Persist per-client runs (client_reports.client_id is required).
    let persisted = false
    let persistNote: string | undefined
    if (clientId) {
      try {
        const period = result.data_as_of ?? generatedAt.slice(0, 10)
        const { error: insertError } = await supabase.from('client_reports').insert({
          client_id: clientId,
          type: REPORT_TYPE,
          period_start: period,
          period_end: generatedAt.slice(0, 10),
          metrics: { checks: result.checks, data_as_of: result.data_as_of, meta_token_dead: result.meta_token_dead },
          draft_md: summary,
          status: 'approved',
        })
        if (insertError) persistNote = `Could not store run: ${insertError.message}`
        else persisted = true
      } catch (err) {
        persistNote = `Could not store run: ${err instanceof Error ? err.message : 'unknown error'}`
      }
    }

    return NextResponse.json({
      generated_at: generatedAt,
      data_as_of: result.data_as_of,
      checks: result.checks,
      summary,
      meta_token_dead: result.meta_token_dead,
      scanned_clients: result.scanned_clients,
      persisted,
      persist_note: persistNote,
    })
  } catch (err) {
    console.error('[ads/recommendations]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
