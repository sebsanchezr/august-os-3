import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { GovDashboard, GovInstantlyDaily } from '@/lib/types'

export const dynamic = 'force-dynamic'

// gov_tenders only ever holds actionable rows (see gov_supabase.py
// NOISE_STATUSES) — found/off_scope/no_bid/no_contact_email never land here.
const OUTREACH_STATUSES = ['pushed_to_instantly', 'replied', 'meeting']
const BID_STATUSES = ['bid_drafted', 'submitted', 'won', 'lost']
const DECIDED_STATUSES = ['won', 'lost']

export async function GET() {
  try {
    const supabase = createSupabaseAdmin()

    const [{ data: tenders, error: tendersErr }, { data: instantlySeries, error: instantlyErr }] = await Promise.all([
      supabase.from('gov_tenders').select('status'),
      supabase.from('gov_instantly_daily').select('*').order('date', { ascending: true }).limit(90),
    ])

    if (tendersErr) return NextResponse.json({ error: tendersErr.message }, { status: 500 })
    if (instantlyErr) return NextResponse.json({ error: instantlyErr.message }, { status: 500 })

    const rows = tenders ?? []
    const by_status: Record<string, number> = {}
    for (const r of rows) {
      by_status[r.status] = (by_status[r.status] ?? 0) + 1
    }

    const outreach_count = rows.filter((r) => OUTREACH_STATUSES.includes(r.status)).length
    const bids_count = rows.filter((r) => BID_STATUSES.includes(r.status)).length
    const decidedCount = rows.filter((r) => DECIDED_STATUSES.includes(r.status)).length
    const wonCount = rows.filter((r) => r.status === 'won').length
    const win_rate = decidedCount > 0 ? wonCount / decidedCount : 0

    const series = (instantlySeries ?? []) as GovInstantlyDaily[]
    const latest = series.length > 0 ? series[series.length - 1] : null

    const dashboard: GovDashboard = {
      by_status,
      outreach_count,
      bids_count,
      win_rate,
      instantly: latest,
      instantly_series: series,
      updated_at: latest?.date ?? null,
    }

    return NextResponse.json(dashboard, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[gov-contracts/route]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
