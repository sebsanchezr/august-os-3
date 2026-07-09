import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { isMetaConfigured, fetchCampaignBreakdown } from '@/lib/meta'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const REPORT_TYPE = 'ads_recommendations'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
    .select('id, draft_md, created_at')
    .eq('client_id', clientId)
    .eq('type', REPORT_TYPE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recommendation: data ?? null })
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

    const prompt = `You are a senior Meta media buyer managing paid social for an ecommerce brand.

Here is the last 14 days of daily account performance (JSON):
${JSON.stringify(dailyMetrics)}

Campaign-level breakdown for the same window (JSON, may be empty if unavailable):
${JSON.stringify(campaigns)}
${campaignNote ? `Note: ${campaignNote}` : ''}

Account targets:
${JSON.stringify(targets)}

Produce 3 to 5 specific, prioritised recommendations (highest priority first). Cover scaling opportunities, cuts to underperforming spend, creative refresh needs, and budget moves between campaigns where the data supports it. For each recommendation, cite the specific metric evidence (numbers) that justifies it, and compare against the account targets where relevant.

Never use em-dashes. Be direct and specific, no generic advice. Format the response as markdown with a short heading per recommendation.`

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
        metrics: { daily: dailyMetrics, campaigns, targets },
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
      generated_at: new Date().toISOString(),
      persisted,
      persist_note: persistNote,
    })
  } catch (err) {
    console.error('[ads/recommendations]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
