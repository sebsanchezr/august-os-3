import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { requireOwner } from '@/lib/access-server'

export const dynamic = 'force-dynamic'

const PRICE_97 = 97

// Normalise ?month= to a YYYY-MM-01 string. Accepts YYYY-MM or YYYY-MM-DD.
function normMonth(input: string | null): string | null {
  if (!input) return null
  const m = input.match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  return `${m[1]}-${m[2]}-01`
}

function nextMonth(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return `${ny}-${String(nm).padStart(2, '0')}-01`
}

export async function GET(req: NextRequest) {
  if (!(await requireOwner())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createSupabaseAdmin()

  // Which months exist (newest first).
  const { data: monthRows } = await supabase
    .from('finance_months')
    .select('month, status')
    .order('month', { ascending: false })
  const availableMonths = (monthRows ?? []).map((r) => ({
    month: r.month as string,
    status: r.status as string,
  }))

  const requested = normMonth(req.nextUrl.searchParams.get('month'))
  const month = requested ?? availableMonths[0]?.month ?? null
  if (!month) {
    return NextResponse.json({
      month: null, summary: null, byCategory: [], revenue: [], drawings: [],
      flags: [], liveSignals: null, availableMonths: [],
    })
  }
  const monthEnd = nextMonth(month)

  const { data: summary } = await supabase
    .from('finance_months')
    .select('*')
    .eq('month', month)
    .maybeSingle()

  const { data: txns } = await supabase
    .from('finance_transactions')
    .select('*')
    .eq('month', month)
    .order('amount', { ascending: false })
  const rows = txns ?? []

  // Agency-only P&L rows.
  const agency = rows.filter((r) => r.is_agency)

  // Costs grouped by category (opex + cost_of_sales).
  const costRows = agency.filter((r) => r.treatment === 'opex' || r.treatment === 'cost_of_sales')
  const byCatMap = new Map<string, number>()
  for (const r of costRows) {
    byCatMap.set(r.category, (byCatMap.get(r.category) ?? 0) + Number(r.amount))
  }
  const byCategory = [...byCatMap.entries()]
    .map(([category, total]) => ({ category, total: Number(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)

  const revenue = agency
    .filter((r) => r.treatment === 'revenue')
    .map((r) => ({ label: r.label, amount: Number(r.amount), source: r.source, client_id: r.client_id }))

  const drawings = agency
    .filter((r) => r.treatment === 'drawings')
    .map((r) => ({ label: r.label, amount: Number(r.amount) }))

  const flags = rows
    .filter((r) => r.flag)
    .map((r) => ({ label: r.label, flag: r.flag as string, amount: Number(r.amount) }))

  // Live, pre-statement signals already flowing into the OS.
  const { data: adRows } = await supabase
    .from('agency_ads_daily')
    .select('spend')
    .gte('date', month)
    .lt('date', monthEnd)
  const agencyAdSpend = (adRows ?? []).reduce((s, r) => s + Number(r.spend ?? 0), 0)

  const { count: offerCount } = await supabase
    .from('ce_website_forms')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'purescale_97_order')
    .gte('created_at', month)
    .lt('created_at', monthEnd)

  const liveSignals = {
    agencyAdSpend: Number(agencyAdSpend.toFixed(2)),
    offerOrders: offerCount ?? 0,
    offerRevenue: (offerCount ?? 0) * PRICE_97,
  }

  return NextResponse.json(
    { month, summary, byCategory, revenue, drawings, flags, liveSignals, availableMonths },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
