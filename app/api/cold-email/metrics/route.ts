import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

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
  const supabase = createSupabaseServer()

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

  // per-campaign breakdown from metrics
  const campaignMap: Record<string, { sent: number; replies: number; positives: number; booked: number }> = {}
  for (const row of metrics) {
    const c = row.campaign ?? 'unknown'
    if (!campaignMap[c]) campaignMap[c] = { sent: 0, replies: 0, positives: 0, booked: 0 }
    campaignMap[c].sent += row.sent ?? 0
    campaignMap[c].replies += row.replies ?? 0
    campaignMap[c].positives += row.positives ?? 0
    campaignMap[c].booked += row.booked ?? 0
  }

  return NextResponse.json({
    kpis: { sent, replies, positives, booked, replyRate, positiveRate, openPipeline, callsBooked },
    campaigns: Object.entries(campaignMap).map(([name, vals]) => ({ name, ...vals })),
    recent: events,
  })
}
