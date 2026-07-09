import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { isMetaConfigured, isMetaMock, fetchCampaignBreakdown, fetchAdEntities, type MetaAdEntity } from '@/lib/meta'
import { runHygieneRules, type HygieneFinding, type HygieneContext } from '@/app/api/ads/_hygiene/rules'
import { FIXTURE_ENTITIES } from '@/app/api/ads/_hygiene/fixture'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const REPORT_TYPE = 'ads_recommendations'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// The mock path lets the whole flow be demoed while the Meta token is dead.
// Allowed when MOCK_META=1 (dev intent) or via ?mock=1, but the query param is
// gated to non-production so it can never be triggered on the live deployment.
function mockAllowed(req: NextRequest): boolean {
  if (isMetaMock()) return true
  const wants = new URL(req.url).searchParams.get('mock') === '1'
  return wants && process.env.NODE_ENV !== 'production'
}

// Compact, LLM-friendly view of an entity so the prompt stays readable.
function entityForPrompt(e: MetaAdEntity) {
  return {
    level: e.level,
    name: e.name,
    status: e.effectiveStatus,
    daily_budget: e.dailyBudget,
    spend_7d: Math.round(e.last7d.spend),
    purchases_7d: e.last7d.purchases,
    roas_7d: e.last7d.roas !== null ? Number(e.last7d.roas.toFixed(2)) : null,
    frequency_7d: Number(e.last7d.frequency.toFixed(2)),
    impressions_7d: e.last7d.impressions,
    spend_prev7d: Math.round(e.prev7d.spend),
    roas_prev7d: e.prev7d.roas !== null ? Number(e.prev7d.roas.toFixed(2)) : null,
  }
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000)
}

function extractText(msg: Anthropic.Message): string {
  const block = msg.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

// GET /api/ads/recommendations?client_id=<uuid>
// Returns the most recently stored recommendation for a client, if any, so
// the ads page can show the last run on load without re-calling the model.
export async function GET(req: NextRequest) {
  const clientId = new URL(req.url).searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id is required' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('client_reports')
    .select('id, draft_md, created_at, metrics')
    .eq('client_id', clientId)
    .eq('type', REPORT_TYPE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const metrics = (data?.metrics ?? null) as { hygiene_findings?: HygieneFinding[] } | null
  const findings = Array.isArray(metrics?.hygiene_findings) ? metrics!.hygiene_findings : []

  return NextResponse.json({
    recommendation: data ? { id: data.id, draft_md: data.draft_md, created_at: data.created_at } : null,
    findings,
  })
}

// POST /api/ads/recommendations { client_id }
// Pulls the last 14 days of client_metrics_daily plus targets, and (if Meta
// is configured) a live campaign breakdown, then asks Claude to act as a
// senior media buyer and produce prioritised recommendations. Stored as a
// client_reports row (type='ads_recommendations', status='approved') so it
// never triggers the normal report approval flow, and so the ads page can
// reload the last recommendation on future visits.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const clientId: string | undefined = body?.client_id
    if (!clientId) return NextResponse.json({ error: 'client_id is required' }, { status: 400 })

    const supabase = createSupabaseAdmin()

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, meta_ad_account_id, target_roas, target_cpa, monthly_budget')
      .eq('id', clientId)
      .maybeSingle()

    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const since = ymd(daysAgo(13))
    const until = ymd(new Date())

    const { data: dailyMetrics, error: metricsError } = await supabase
      .from('client_metrics_daily')
      .select('date, spend, revenue, roas, purchases, cpa, impressions, clicks, ctr')
      .eq('client_id', clientId)
      .gte('date', since)
      .order('date', { ascending: true })

    if (metricsError) return NextResponse.json({ error: metricsError.message }, { status: 500 })

    if (!dailyMetrics || dailyMetrics.length === 0) {
      return NextResponse.json(
        { error: 'No ad metrics yet for this client, nothing to base recommendations on.' },
        { status: 400 },
      )
    }

    let campaignBreakdown: Awaited<ReturnType<typeof fetchCampaignBreakdown>> | null = null
    if (isMetaConfigured() && client.meta_ad_account_id) {
      const res = await fetchCampaignBreakdown(client.meta_ad_account_id, since, until)
      campaignBreakdown = res
    }

    const campaigns = campaignBreakdown?.ok ? campaignBreakdown.data : []
    const campaignNote = campaignBreakdown && !campaignBreakdown.ok
      ? `Live campaign breakdown unavailable: ${campaignBreakdown.error}`
      : campaigns.length === 0
        ? 'No live campaign breakdown available.'
        : null

    const targets = {
      target_roas: client.target_roas,
      target_cpa: client.target_cpa,
      monthly_budget: client.monthly_budget,
    }

    // ── Entity-level pull + deterministic hygiene checks ──────────────────
    // Fetch fresh campaign/adset/ad state (mock when the Meta token is dead),
    // run the rule engine BEFORE the model, and persist a snapshot so the run
    // is auditable. The findings, not strategy, are what the media buyer wants.
    const useMock = mockAllowed(req)
    let entities: MetaAdEntity[] = []
    let entityNote: string | null = null

    if (useMock) {
      entities = FIXTURE_ENTITIES
      entityNote = 'Using mock ad-entity data (Meta token unavailable).'
    } else if (isMetaConfigured() && client.meta_ad_account_id) {
      const res = await fetchAdEntities(client.meta_ad_account_id)
      if (res.ok) {
        entities = res.data
      } else {
        entityNote = `Entity-level data unavailable: ${res.error}`
      }
    } else {
      entityNote = 'No entity-level data (Meta not connected).'
    }

    const hygieneCtx: HygieneContext = {
      targetRoas: client.target_roas ?? null,
      targetCpa: client.target_cpa ?? null,
      currency: '£',
    }
    const findings: HygieneFinding[] = entities.length > 0 ? runHygieneRules(entities, hygieneCtx) : []

    const snapshotDate = until
    if (entities.length > 0) {
      const snapshotRows = entities.map((e) => ({
        client_id: clientId,
        snapshot_date: snapshotDate,
        level: e.level,
        entity_id: e.id,
        entity_name: e.name,
        effective_status: e.effectiveStatus,
        daily_budget: e.dailyBudget,
        spend_7d: e.last7d.spend,
        purchases_7d: e.last7d.purchases,
        revenue_7d: e.last7d.revenue,
        roas_7d: e.last7d.roas,
        ctr_7d: e.last7d.ctr,
        frequency: e.last7d.frequency,
        spend_prev7d: e.prev7d.spend,
        roas_prev7d: e.prev7d.roas,
        raw: e as unknown as Record<string, unknown>,
      }))
      const { error: snapError } = await supabase
        .from('ad_entities_snapshot')
        .upsert(snapshotRows, { onConflict: 'client_id,snapshot_date,level,entity_id' })
      if (snapError) console.error('[ads/recommendations] snapshot upsert failed', snapError.message)
    }

    const prompt = `You are a senior Meta media buyer doing an operational review of an ad account. Your ONLY job is to surface things the media buyer may have MISSED operationally or creatively: something left running that should be off, a winner that was paused by mistake, delivery that has stalled, or creative that has fatigued. This is NOT a strategy review. Do NOT suggest new audiences, new campaign structures, new creative concepts, bidding strategies, or scaling plans.

A deterministic rule engine has already flagged the following issues (JSON). Treat these as the backbone of your review:
${JSON.stringify(findings)}
${findings.length === 0 ? 'The rule engine found no hard flags. Still scan the entity table below for anything operationally odd.' : ''}

Current campaign / ad set / ad state, last 7 days vs previous 7 days (JSON):
${JSON.stringify(entities.map(entityForPrompt))}
${entityNote ? `Note: ${entityNote}` : ''}

Account targets (for reference only, not for strategy advice):
${JSON.stringify(targets)}

Write a short prioritised checklist (highest severity first) of operational items for the media buyer to verify. For each item: name the exact entity, state what looks wrong with the specific numbers, and phrase it as a "check this / did you mean to do this" prompt, not a strategy instruction. If an issue is a clear mistake (money spent with zero sales, a paused winner), say so plainly.

Never use em-dashes. Be direct and specific. Format as markdown with a short heading per item.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const markdown = extractText(message).trim()

    let persisted = false
    let persistNote: string | undefined

    try {
      const { error: insertError } = await supabase.from('client_reports').insert({
        client_id: clientId,
        type: REPORT_TYPE,
        period_start: since,
        period_end: until,
        metrics: { daily: dailyMetrics, campaigns, targets, hygiene_findings: findings },
        draft_md: markdown,
        status: 'approved',
      })

      if (insertError) {
        persistNote = `Could not store recommendation: ${insertError.message}`
      } else {
        persisted = true
      }
    } catch (err) {
      persistNote = `Could not store recommendation: ${err instanceof Error ? err.message : 'unknown error'}`
    }

    return NextResponse.json({
      markdown,
      findings,
      entity_note: entityNote,
      mock: useMock,
      generated_at: new Date().toISOString(),
      persisted,
      persist_note: persistNote,
    })
  } catch (err) {
    console.error('[ads/recommendations]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
