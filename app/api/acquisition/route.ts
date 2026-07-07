import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { AcquisitionRollup, ChannelFunnel, ChannelROI } from '@/lib/types'

export const dynamic = 'force-dynamic'

function getWindowBounds(window: string): { windowStart: string; windowEnd: string | null; days: number } {
  if (window === 'qtd') {
    const now = new Date()
    const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3
    const start = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1))
    const days = Math.max(1, Math.round((now.getTime() - start.getTime()) / 86400000))
    return { windowStart: start.toISOString(), windowEnd: null, days }
  }
  const days = window === '30d' ? 30 : 7
  return { windowStart: new Date(Date.now() - days * 86400000).toISOString(), windowEnd: null, days }
}

function emptyFunnel(): ChannelFunnel {
  return { sourced: 0, contacted: 0, positive_reply: 0, booked: 0, showed: 0, won: 0 }
}

function addFunnel(a: ChannelFunnel, b: ChannelFunnel): ChannelFunnel {
  return {
    sourced: a.sourced + b.sourced,
    contacted: a.contacted + b.contacted,
    positive_reply: a.positive_reply + b.positive_reply,
    booked: a.booked + b.booked,
    showed: a.showed + b.showed,
    won: a.won + b.won,
  }
}

export async function GET(req: NextRequest) {
  try {
    const win = new URL(req.url).searchParams.get('window') ?? '7d'
    const { windowStart, windowEnd } = getWindowBounds(win)
    const nowIso = new Date().toISOString()

    const supabase = createSupabaseAdmin()

    function applyWindow<T>(q: T, col: string, start: string, end: string | null): T {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (q as any).gte(col, start)
      if (end) query = query.lt(col, end)
      return query
    }

    const windowStartDate = windowStart.slice(0, 10)

    // ─── cold_call ────────────────────────────────────────────────────────
    const [
      { count: cc_sourced },
      { data: ccActivityRows },
      { count: cc_positive },
      { count: cc_booked },
      { count: cc_showed },
      { count: cc_won },
    ] = await Promise.all([
      applyWindow(supabase.from('call_leads').select('*', { count: 'exact', head: true }), 'created_at', windowStart, windowEnd),
      applyWindow(supabase.from('call_activity').select('lead_id'), 'created_at', windowStart, windowEnd),
      applyWindow(supabase.from('call_activity').select('*', { count: 'exact', head: true }).eq('outcome', 'positive'), 'created_at', windowStart, windowEnd),
      applyWindow(supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('source', 'cold_call'), 'created_at', windowStart, windowEnd),
      applyWindow(supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('source', 'cold_call').in('status', ['showed', 'closed']), 'created_at', windowStart, windowEnd),
      applyWindow(supabase.from('deals').select('*', { count: 'exact', head: true }), 'closed_at', windowStart, windowEnd),
    ])

    const cc_contacted = new Set((ccActivityRows ?? []).map((r) => r.lead_id)).size

    const coldCall: ChannelFunnel = {
      sourced: cc_sourced ?? 0,
      contacted: cc_contacted,
      positive_reply: cc_positive ?? 0,
      booked: cc_booked ?? 0,
      showed: cc_showed ?? 0,
      won: cc_won ?? 0,
    }

    // ─── cold_email ───────────────────────────────────────────────────────
    // "contacted" and "positive_reply" are approximated from the ce_metrics_daily
    // Instantly roll-up (sent / positives) since there is no per-lead "contacted"
    // event table. "showed" and "won" are approximated from ce_pipeline stage
    // entries (stage_entered_at) since ce_bookings has no showed/won status.
    const [
      { count: ce_sourced },
      { data: ceMetricsRows },
      { count: ce_booked },
      { count: ce_showed },
      { count: ce_won },
    ] = await Promise.all([
      applyWindow(supabase.from('ce_leads').select('*', { count: 'exact', head: true }), 'created_at', windowStart, windowEnd),
      supabase.from('ce_metrics_daily').select('sent, positives').gte('date', windowStartDate),
      applyWindow(supabase.from('ce_bookings').select('*', { count: 'exact', head: true }), 'created_at', windowStart, windowEnd),
      applyWindow(supabase.from('ce_pipeline').select('*', { count: 'exact', head: true }).eq('stage', 'showed'), 'stage_entered_at', windowStart, windowEnd),
      applyWindow(supabase.from('ce_pipeline').select('*', { count: 'exact', head: true }).eq('stage', 'won'), 'stage_entered_at', windowStart, windowEnd),
    ])

    const ce_contacted = (ceMetricsRows ?? []).reduce((s, r) => s + (r.sent ?? 0), 0)
    const ce_positive = (ceMetricsRows ?? []).reduce((s, r) => s + (r.positives ?? 0), 0)

    const coldEmail: ChannelFunnel = {
      sourced: ce_sourced ?? 0,
      contacted: ce_contacted,
      positive_reply: ce_positive,
      booked: ce_booked ?? 0,
      showed: ce_showed ?? 0,
      won: ce_won ?? 0,
    }

    // ─── linkedin ─────────────────────────────────────────────────────────
    // Sourced/contacted/positive_reply come from lead_activities (channel='linkedin').
    // "booked" is approximated via reply_conversations.state='booked' restricted to
    // lead_ids that have ever had a linkedin connection_sent activity. There is no
    // showed/won tracking wired up for linkedin yet, so those return 0.
    const [
      { count: li_sourced },
      { count: li_contacted },
      { count: li_positive },
      { data: liLeadRows },
    ] = await Promise.all([
      applyWindow(supabase.from('lead_activities').select('*', { count: 'exact', head: true }).eq('channel', 'linkedin').eq('event_type', 'connection_sent'), 'occurred_at', windowStart, windowEnd),
      applyWindow(supabase.from('lead_activities').select('*', { count: 'exact', head: true }).eq('channel', 'linkedin').eq('event_type', 'dm_step_1_sent'), 'occurred_at', windowStart, windowEnd),
      applyWindow(supabase.from('lead_activities').select('*', { count: 'exact', head: true }).eq('channel', 'linkedin').eq('event_type', 'reply_received'), 'occurred_at', windowStart, windowEnd),
      supabase.from('lead_activities').select('lead_id').eq('channel', 'linkedin').eq('event_type', 'connection_sent'),
    ])

    let li_booked = 0
    const liLeadIds = [...new Set((liLeadRows ?? []).map((r) => r.lead_id).filter(Boolean))]
    if (liLeadIds.length > 0) {
      const { count } = await applyWindow(
        supabase.from('reply_conversations').select('*', { count: 'exact', head: true }).eq('state', 'booked').in('lead_id', liLeadIds),
        'booked_at',
        windowStart,
        windowEnd,
      )
      li_booked = count ?? 0
    }

    const linkedin: ChannelFunnel = {
      sourced: li_sourced ?? 0,
      contacted: li_contacted ?? 0,
      positive_reply: li_positive ?? 0,
      booked: li_booked,
      showed: 0,
      won: 0,
    }

    // ─── gov ──────────────────────────────────────────────────────────────
    // gov_tenders is synced from the gov engine's CSV tracker, not a live
    // event stream, so window filtering uses date_added/last_update dates
    // rather than the same timestamp columns as the other channels. There is
    // no "showed" concept for a public sector meeting, so showed == booked.
    const { data: govRows } = await supabase.from('gov_tenders').select('status, date_added, last_update')
    const govAll = govRows ?? []
    const gov_sourced = govAll.filter((r) => r.date_added && r.date_added >= windowStartDate).length
    const gov_contacted = govAll.filter((r) =>
      ['pushed_to_instantly', 'replied', 'meeting', 'bid_drafted', 'submitted', 'won', 'lost'].includes(r.status)
      && r.last_update && r.last_update >= windowStartDate,
    ).length
    const gov_positive = govAll.filter((r) =>
      ['replied', 'meeting', 'bid_drafted', 'submitted', 'won', 'lost'].includes(r.status)
      && r.last_update && r.last_update >= windowStartDate,
    ).length
    // "booked" must mean an actual meeting was booked with the buyer — status
    // 'meeting' only. bid_drafted/submitted/won/lost are downstream bid-process
    // stages, not booked calls, and were previously (incorrectly) counted here
    // too, which inflated this number with contracts that never had a meeting.
    const gov_booked = govAll.filter((r) =>
      r.status === 'meeting'
      && r.last_update && r.last_update >= windowStartDate,
    ).length
    const gov_won = govAll.filter((r) => r.status === 'won' && r.last_update && r.last_update >= windowStartDate).length

    const gov: ChannelFunnel & { note: string } = {
      sourced: gov_sourced,
      contacted: gov_contacted,
      positive_reply: gov_positive,
      booked: gov_booked,
      showed: gov_booked,
      won: gov_won,
      note: 'booked/showed both mean "status = meeting" — no separate show tracking for public sector meetings; bid_drafted/submitted/won/lost are bid-process stages, not booked calls',
    }

    const blended = [coldCall, coldEmail, linkedin, gov].reduce(addFunnel, emptyFunnel())

    // ─── Pipeline-backed monetary figures (unified across all channels) ────
    const { data: wonDealsWindow } = await applyWindow(
      supabase.from('pipeline_deals').select('mrr_value, source_channel').eq('stage', 'won'),
      'updated_at',
      windowStart,
      windowEnd,
    )

    const new_mrr = (wonDealsWindow ?? []).reduce((s, d) => s + (d.mrr_value ?? 0), 0)

    const roiByChannel: Record<string, ChannelROI> = {}
    for (const ch of ['cold_call', 'cold_email', 'linkedin', 'gov', 'referral', 'expansion', 'other']) {
      roiByChannel[ch] = { channel: ch, booked: 0, won: 0, new_mrr: 0 }
    }
    roiByChannel.cold_call.booked = coldCall.booked
    roiByChannel.cold_email.booked = coldEmail.booked
    roiByChannel.linkedin.booked = linkedin.booked
    roiByChannel.gov.booked = gov.booked
    for (const d of wonDealsWindow ?? []) {
      const ch = d.source_channel ?? 'other'
      if (!roiByChannel[ch]) roiByChannel[ch] = { channel: ch, booked: 0, won: 0, new_mrr: 0 }
      roiByChannel[ch].won += 1
      roiByChannel[ch].new_mrr += d.mrr_value ?? 0
    }
    const roi: ChannelROI[] = Object.values(roiByChannel).filter((r) => r.booked > 0 || r.won > 0 || r.new_mrr > 0)

    // ─── KPIs ───────────────────────────────────────────────────────────────
    const new_prospects = blended.sourced
    const booked_calls = blended.booked
    const show_rate = blended.booked > 0 ? blended.showed / blended.booked : 0
    const close_rate = blended.showed > 0 ? blended.won / blended.showed : 0

    const rollup: AcquisitionRollup = {
      window: win,
      window_start: windowStart,
      generated_at: nowIso,
      currency: 'GBP',
      currency_note: 'all figures assumed GBP, mixed-currency pipeline deals are not yet normalized',
      channels: { cold_call: coldCall, cold_email: coldEmail, linkedin, gov },
      blended,
      kpis: {
        new_prospects,
        booked_calls,
        show_rate,
        close_rate,
        new_mrr,
      },
      roi,
    }

    return NextResponse.json(rollup, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[acquisition/route]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
