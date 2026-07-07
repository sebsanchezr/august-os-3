import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { DashboardMetrics, CallerStats, TrendPoint, RecentActivity } from '@/lib/types'

export const dynamic = 'force-dynamic'

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

export async function GET(req: NextRequest) {
  try {
    const win = new URL(req.url).searchParams.get('window') ?? '7d'
    const { windowStart, windowEnd, days } = getWindowBounds(win)

    const prevStart = new Date(new Date(windowStart).getTime() - days * 86400000).toISOString()
    const prevEnd = windowStart

    const supabase = createSupabaseAdmin()

    function applyWindow<T>(q: T, start: string, end: string | null): T {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (q as any).gte('created_at', start)
      if (end) query = query.lt('created_at', end)
      return query
    }
    function applyWindowDeals<T>(q: T, start: string, end: string | null): T {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (q as any).gte('closed_at', start)
      if (end) query = query.lt('closed_at', end)
      return query
    }

    const [
      { count: calls_made },
      { count: prev_calls_made },
      { count: positive_replies },
      { count: prev_positive_replies },
      { count: calls_booked },
      { count: prev_calls_booked },
      { data: dealsData },
      { data: prevDealsData },
    ] = await Promise.all([
      applyWindow(supabase.from('call_activity').select('*', { count: 'exact', head: true }), windowStart, windowEnd),
      supabase.from('call_activity').select('*', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd),
      applyWindow(supabase.from('call_activity').select('*', { count: 'exact', head: true }).in('outcome', ['positive', 'callback', 'booked']), windowStart, windowEnd),
      supabase.from('call_activity').select('*', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd).in('outcome', ['positive', 'callback', 'booked']),
      applyWindow(supabase.from('bookings').select('*', { count: 'exact', head: true }), windowStart, windowEnd),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd),
      applyWindowDeals(supabase.from('deals').select('setup_amount, monthly_amount').in('status', ['paid', 'live']), windowStart, windowEnd),
      supabase.from('deals').select('setup_amount').gte('closed_at', prevStart).lt('closed_at', prevEnd).in('status', ['paid', 'live']),
    ])

    const deals_closed = dealsData?.length ?? 0
    const setup_revenue = dealsData?.reduce((s, d) => s + (d.setup_amount ?? 0), 0) ?? 0
    const monthly_revenue = dealsData?.reduce((s, d) => s + (d.monthly_amount ?? 0), 0) ?? 0
    const prev_deals_closed = prevDealsData?.length ?? 0
    const prev_setup_revenue = prevDealsData?.reduce((s, d) => s + (d.setup_amount ?? 0), 0) ?? 0
    const callsMadeNum = calls_made ?? 0
    const callsBookedNum = calls_booked ?? 0

    const metrics: DashboardMetrics = {
      calls_made: callsMadeNum,
      positive_replies: positive_replies ?? 0,
      calls_booked: callsBookedNum,
      deals_closed,
      setup_revenue,
      monthly_revenue,
      close_rate: callsBookedNum > 0 ? deals_closed / callsBookedNum : 0,
      book_rate: callsMadeNum > 0 ? callsBookedNum / callsMadeNum : 0,
      prev_calls_made: prev_calls_made ?? 0,
      prev_positive_replies: prev_positive_replies ?? 0,
      prev_calls_booked: prev_calls_booked ?? 0,
      prev_deals_closed,
      prev_setup_revenue,
    }

    // Trend (fill all days, group by date)
    const [{ data: rawCalls }, { data: rawBookings }, { data: rawDeals }] = await Promise.all([
      applyWindow(supabase.from('call_activity').select('created_at'), windowStart, windowEnd),
      applyWindow(supabase.from('bookings').select('created_at'), windowStart, windowEnd),
      applyWindowDeals(supabase.from('deals').select('closed_at').in('status', ['paid', 'live']), windowStart, windowEnd),
    ])

    const trendMap: Record<string, { calls: number; booked: number; closed: number }> = {}
    rawCalls?.forEach(r => { const d = r.created_at.slice(0, 10); if (!trendMap[d]) trendMap[d] = { calls: 0, booked: 0, closed: 0 }; trendMap[d].calls++ })
    rawBookings?.forEach(r => { const d = r.created_at.slice(0, 10); if (!trendMap[d]) trendMap[d] = { calls: 0, booked: 0, closed: 0 }; trendMap[d].booked++ })
    rawDeals?.forEach(r => { const d = r.closed_at.slice(0, 10); if (!trendMap[d]) trendMap[d] = { calls: 0, booked: 0, closed: 0 }; trendMap[d].closed++ })

    const trendDays: TrendPoint[] = []
    for (let i = days - 1; i >= 0; i--) {
      const base = windowEnd ? new Date(new Date(windowEnd).getTime() - (i + 1) * 86400000) : new Date(Date.now() - i * 86400000)
      const date = base.toISOString().slice(0, 10)
      trendDays.push({ date, ...(trendMap[date] ?? { calls: 0, booked: 0, closed: 0 }) })
    }

    // Leaderboard
    const [{ data: activityRows }, { data: bookingRows }, { data: dealRows }] = await Promise.all([
      applyWindow(supabase.from('call_activity').select('caller_id, outcome, callers(name)'), windowStart, windowEnd),
      applyWindow(supabase.from('bookings').select('caller_id'), windowStart, windowEnd),
      applyWindowDeals(supabase.from('deals').select('caller_id, setup_amount').in('status', ['paid', 'live']), windowStart, windowEnd),
    ])

    const callerMap: Record<string, CallerStats> = {}
    activityRows?.forEach(row => {
      const cid = row.caller_id ?? 'unknown'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const name = (row.callers as any)?.name ?? 'Unknown'
      if (!callerMap[cid]) callerMap[cid] = { caller_id: cid, caller_name: name, calls: 0, positives: 0, booked: 0, closed: 0, revenue: 0 }
      callerMap[cid].calls++
      if (['positive', 'callback', 'booked'].includes(row.outcome)) callerMap[cid].positives++
    })
    bookingRows?.forEach(row => { const cid = row.caller_id ?? 'unknown'; if (callerMap[cid]) callerMap[cid].booked++ })
    dealRows?.forEach(row => { const cid = row.caller_id ?? 'unknown'; if (callerMap[cid]) { callerMap[cid].closed++; callerMap[cid].revenue += row.setup_amount ?? 0 } })
    const leaderboard = Object.values(callerMap).sort((a, b) => b.closed - a.closed || b.revenue - a.revenue)

    // Recent activity
    const [{ data: recentCalls }, { data: recentBookings }] = await Promise.all([
      supabase.from('call_activity').select('id, outcome, created_at, caller_id, callers(name), call_leads(company)').order('created_at', { ascending: false }).limit(20),
      supabase.from('bookings').select('id, business_name, created_at, caller_id, callers(name)').order('created_at', { ascending: false }).limit(5),
    ])

    const recent: RecentActivity[] = [
      ...(recentCalls ?? []).map(r => ({
        id: r.id, type: 'call' as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: `${r.outcome.replace(/_/g, ' ')} — ${(r.call_leads as any)?.company ?? 'Unknown'}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        caller_name: (r.callers as any)?.name ?? null, created_at: r.created_at,
      })),
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
