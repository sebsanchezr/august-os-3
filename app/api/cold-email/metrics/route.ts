import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

type Window = 'yesterday' | '7d' | '30d'

function getDateRange(win: Window): { start: string; days: number } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  if (win === 'yesterday') {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return { start: fmt(d), days: 1 }
  }
  if (win === '7d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return { start: fmt(d), days: 7 }
  }
  const d = new Date(now)
  d.setDate(d.getDate() - 30)
  return { start: fmt(d), days: 30 }
}

export async function GET(req: NextRequest) {
  const win = (req.nextUrl.searchParams.get('window') ?? '7d') as Window
  const supabase = createSupabaseAdmin()

  const { start } = getDateRange(win)

  const [metricsRes, pipelineRes, eventsRes] = await Promise.all([
    supabase
      .from('ce_metrics_daily')
      .select('*')
      .gte('date', start)
      .order('date', { ascending: false }),

    supabase
      .from('ce_pipeline')
      .select('stage, value, lead_id'),

    supabase
      .from('ce_events')
      .select('id, type, payload, occurred_at, lead_id, ce_leads(email, first_name, last_name, company, campaign)')
      .eq('type', 'reply_in')
      .not('payload->>bucket', 'in', '(hard_no,wrong_person)')
      .order('occurred_at', { ascending: false })
      .limit(20),
  ])

  const metrics = metricsRes.data ?? []
  const pipeline = pipelineRes.data ?? []
  const events = eventsRes.data ?? []

  const sent = metrics.reduce((s, r) => s + (r.sent ?? 0), 0)
  const replies = metrics.reduce((s, r) => s + (r.replies ?? 0), 0)
  const positives = metrics.reduce((s, r) => s + (r.positives ?? 0), 0)
  const booked = metrics.reduce((s, r) => s + (r.booked ?? 0), 0)
  const replyRate = sent > 0 ? (replies / sent) * 100 : 0
  const positiveRate = replies > 0 ? (positives / replies) * 100 : 0

  // pipeline counts by stage
  const openStages = ['new_reply', 'qualified', 'creatives_in_production', 'creatives_delivered', 'call_booked', 'showed', 'proposal']
  const openPipeline = pipeline.filter((p) => openStages.includes(p.stage)).length
  const callsBooked = pipeline.filter((p) => p.stage === 'call_booked').length

  // per-campaign breakdown from metrics. Group on campaign_id when the
  // Instantly sync has populated it (029_ce_metrics_campaign.sql), falling
  // back to the legacy free-text campaign label otherwise.
  const campaignMap: Record<
    string,
    { name: string; campaignName: string | null; sent: number; replies: number; positives: number; bounces: number; booked: number }
  > = {}
  for (const row of metrics) {
    const key = row.campaign_id ?? row.campaign ?? 'unknown'
    if (!campaignMap[key]) {
      campaignMap[key] = {
        name: row.campaign ?? 'unknown',
        campaignName: row.campaign_name ?? null,
        sent: 0,
        replies: 0,
        positives: 0,
        bounces: 0,
        booked: 0,
      }
    }
    campaignMap[key].sent += row.sent ?? 0
    campaignMap[key].replies += row.replies ?? 0
    campaignMap[key].positives += row.positives ?? 0
    campaignMap[key].bounces += row.bounces ?? 0
    campaignMap[key].booked += row.booked ?? 0
  }

  const bounces = metrics.reduce((s, r) => s + (r.bounces ?? 0), 0)

  return NextResponse.json({
    kpis: { sent, replies, positives, booked, bounces, replyRate, positiveRate, openPipeline, callsBooked },
    campaigns: Object.values(campaignMap),
    recent: events,
  })
}
