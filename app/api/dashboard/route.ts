import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { DashboardMetrics, CallerStats, TrendPoint, RecentActivity } from '@/lib/types'

export const dynamic = 'force-dynamic'

// ─── Report-date window (eod_reports.report_date is a plain DATE column) ──────
// report_date comes back from Supabase as a plain 'YYYY-MM-DD' string. We build
// comparison bounds from local calendar arithmetic (no toISOString()/UTC shift)
// so a 'gte'/'lte' string comparison lines up with what was actually submitted.

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  return ymd(dt)
}

function getReportDateWindow(window: string): { start: string; end: string; days: number; prevStart: string; prevEnd: string } {
  const today = ymd(new Date())
  if (window === 'yesterday') {
    const day = addDays(today, -1)
    return { start: day, end: day, days: 1, prevStart: addDays(day, -1), prevEnd: addDays(day, -1) }
  }
  const days = window === '30d' ? 30 : 7
  const start = addDays(today, -(days - 1))
  const prevEnd = addDays(start, -1)
  const prevStart = addDays(prevEnd, -(days - 1))
  return { start, end: today, days, prevStart, prevEnd }
}

// ─── ISO timestamp window (bookings + deals keep their existing behaviour) ────

function getWindowBounds(window: string): { windowStart: string; windowEnd: string | null; days: number } {
  if (window === 'yesterday') {
    const now = new Date()
    const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const yesterdayMidnight = new Date(todayMidnight.getTime() - 86400000)
    return { windowStart: yesterdayMidnight.toISOString(), windowEnd: todayMidnight.toISOString(), days: 1 }
  }
  const days = window === '30d' ? 30 : 7
  return { windowStart: new Date(Date.now() - days * 86400000).toISOString(), windowEnd: null, days }
}

type EodRow = { report_date: string; caller_name: string; calls_made: number; positive_replies: number; calls_booked: number }

export async function GET(req: NextRequest) {
  try {
    const win = new URL(req.url).searchParams.get('window') ?? '7d'
    const { start, end, days, prevStart, prevEnd } = getReportDateWindow(win)
    const { windowStart, windowEnd } = getWindowBounds(win)

    const dealsPrevStart = new Date(new Date(windowStart).getTime() - days * 86400000).toISOString()
    const dealsPrevEnd = windowStart

    const supabase = createSupabaseAdmin()

    function applyWindowDeals<T>(q: T, start: string, end: string | null): T {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (q as any).gte('closed_at', start)
      if (end) query = query.lt('closed_at', end)
      return query
    }

    const [
      { data: eodCurrent },
      { data: eodPrev },
      { data: dealsData },
      { data: prevDealsData },
    ] = await Promise.all([
      supabase.from('eod_reports').select('report_date, caller_name, calls_made, positive_replies, calls_booked').gte('report_date', start).lte('report_date', end),
      supabase.from('eod_reports').select('calls_made, positive_replies, calls_booked').gte('report_date', prevStart).lte('report_date', prevEnd),
      applyWindowDeals(supabase.from('deals').select('setup_amount, monthly_amount').in('status', ['paid', 'live']), windowStart, windowEnd),
      supabase.from('deals').select('setup_amount').gte('closed_at', dealsPrevStart).lt('closed_at', dealsPrevEnd).in('status', ['paid', 'live']),
    ])

    const eodRows = (eodCurrent ?? []) as EodRow[]

    const calls_made = eodRows.reduce((s, r) => s + (r.calls_made ?? 0), 0)
    const positive_replies = eodRows.reduce((s, r) => s + (r.positive_replies ?? 0), 0)
    const calls_booked = eodRows.reduce((s, r) => s + (r.calls_booked ?? 0), 0)

    const prev_calls_made = (eodPrev ?? []).reduce((s, r) => s + (r.calls_made ?? 0), 0)
    const prev_positive_replies = (eodPrev ?? []).reduce((s, r) => s + (r.positive_replies ?? 0), 0)
    const prev_calls_booked = (eodPrev ?? []).reduce((s, r) => s + (r.calls_booked ?? 0), 0)

    const deals_closed = dealsData?.length ?? 0
    const setup_revenue = dealsData?.reduce((s, d) => s + (d.setup_amount ?? 0), 0) ?? 0
    const monthly_revenue = dealsData?.reduce((s, d) => s + (d.monthly_amount ?? 0), 0) ?? 0
    const prev_deals_closed = prevDealsData?.length ?? 0
    const prev_setup_revenue = prevDealsData?.reduce((s, d) => s + (d.setup_amount ?? 0), 0) ?? 0

    const metrics: DashboardMetrics = {
      calls_made,
      positive_replies,
      calls_booked,
      deals_closed,
      setup_revenue,
      monthly_revenue,
      close_rate: calls_booked > 0 ? deals_closed / calls_booked : 0,
      book_rate: calls_made > 0 ? calls_booked / calls_made : 0,
      prev_calls_made,
      prev_positive_replies,
      prev_calls_booked,
      prev_deals_closed,
      prev_setup_revenue,
    }

    // ─── Trend: calls + booked from eod_reports (by report_date), closed from deals ──
    const { data: rawDeals } = await applyWindowDeals(supabase.from('deals').select('closed_at').in('status', ['paid', 'live']), windowStart, windowEnd)

    const trendMap: Record<string, { calls: number; booked: number; closed: number }> = {}
    eodRows.forEach(r => {
      const d = r.report_date
      if (!trendMap[d]) trendMap[d] = { calls: 0, booked: 0, closed: 0 }
      trendMap[d].calls += r.calls_made ?? 0
      trendMap[d].booked += r.calls_booked ?? 0
    })
    ;(rawDeals ?? []).forEach((r: { closed_at: string }) => {
      const d = r.closed_at.slice(0, 10)
      if (!trendMap[d]) trendMap[d] = { calls: 0, booked: 0, closed: 0 }
      trendMap[d].closed++
    })

    const trendDays: TrendPoint[] = []
    for (let d = start; ; d = addDays(d, 1)) {
      trendDays.push({ date: d, ...(trendMap[d] ?? { calls: 0, booked: 0, closed: 0 }) })
      if (d === end) break
    }

    // ─── Leaderboard: grouped by caller_name from eod_reports ──────────────────
    const { data: dealRows } = await applyWindowDeals(
      supabase.from('deals').select('caller_id, setup_amount, callers(name)').in('status', ['paid', 'live']),
      windowStart,
      windowEnd
    )

    const callerMap: Record<string, CallerStats> = {}
    eodRows.forEach(r => {
      const name = r.caller_name?.trim() || 'Unknown'
      const key = name.toLowerCase()
      if (!callerMap[key]) callerMap[key] = { caller_id: name, caller_name: name, calls: 0, positives: 0, booked: 0, closed: 0, revenue: 0 }
      callerMap[key].calls += r.calls_made ?? 0
      callerMap[key].positives += r.positive_replies ?? 0
      callerMap[key].booked += r.calls_booked ?? 0
    })
    // Best-effort revenue attribution: match a deal's caller name to an eod caller_name.
    // (callers/deals caller_id linkage is a separate, currently-unused pipeline, so this
    // only attaches data when the names happen to line up; otherwise closed/revenue stay 0.)
    ;(dealRows ?? []).forEach((row: { setup_amount: number | null; callers: { name?: string } | { name?: string }[] | null }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callerRel = row.callers as any
      const name = (Array.isArray(callerRel) ? callerRel[0]?.name : callerRel?.name)?.trim()
      if (!name) return
      const key = name.toLowerCase()
      if (!callerMap[key]) return
      callerMap[key].closed++
      callerMap[key].revenue += row.setup_amount ?? 0
    })
    const leaderboard = Object.values(callerMap).sort((a, b) => b.calls - a.calls || b.closed - a.closed || b.revenue - a.revenue)

    // ─── Recent activity: latest EOD submissions + recent bookings ─────────────
    const [{ data: recentEod }, { data: recentBookings }] = await Promise.all([
      supabase.from('eod_reports').select('id, report_date, caller_name, calls_made, positive_replies, calls_booked, notes, created_at').order('report_date', { ascending: false }).order('created_at', { ascending: false }).limit(20),
      supabase.from('bookings').select('id, business_name, created_at, caller_id, callers(name)').order('created_at', { ascending: false }).limit(5),
    ])

    const recent: RecentActivity[] = [
      ...(recentEod ?? []).map(r => {
        const notesSnippet = r.notes ? `: "${r.notes.length > 60 ? r.notes.slice(0, 60) + '...' : r.notes}"` : ''
        return {
          id: r.id,
          type: 'call' as const,
          description: `EOD for ${r.report_date} - ${r.calls_made} calls, ${r.positive_replies} positives, ${r.calls_booked} booked${notesSnippet}`,
          caller_name: r.caller_name ?? null,
          created_at: r.created_at,
        }
      }),
      ...(recentBookings ?? []).map(r => ({
        id: r.id, type: 'booking' as const, description: `Booked: ${r.business_name}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        caller_name: (r.callers as any)?.name ?? null, created_at: r.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 25)

    return NextResponse.json({ metrics, trend: trendDays, leaderboard, recent }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[dashboard/route]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
