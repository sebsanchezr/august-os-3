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
      // deadline + synced_at are optional (migration 050) — selecting * keeps
      // this working whether or not the columns exist yet.
      supabase.from('gov_tenders').select('*'),
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

    // Bid Manager KPI row
    const awaiting_submission = rows.filter((r) => r.status === 'bid_drafted').length
    const submitted_count = rows.filter((r) => r.status === 'submitted').length
    const won_count = wonCount

    // Deadlines in the next 14 days (only rows that actually carry a deadline).
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in14 = new Date(today)
    in14.setDate(in14.getDate() + 14)
    const deadlines_14d = rows.filter((r) => {
      const d = r.deadline ? new Date(r.deadline) : null
      return d != null && !Number.isNaN(d.getTime()) && d >= today && d <= in14
    }).length

    // Pipeline health: newest synced_at across all tenders + stale >48h flag.
    let last_sync: string | null = null
    for (const r of rows) {
      const s = (r as { synced_at?: string | null }).synced_at
      if (s && (last_sync == null || s > last_sync)) last_sync = s
    }
    const sync_stale = last_sync != null
      ? (Date.now() - new Date(last_sync).getTime()) > 48 * 60 * 60 * 1000
      : true

    const series = (instantlySeries ?? []) as GovInstantlyDaily[]
    const latest = series.length > 0 ? series[series.length - 1] : null

    const dashboard: GovDashboard = {
      by_status,
      outreach_count,
      bids_count,
      win_rate,
      awaiting_submission,
      submitted_count,
      won_count,
      deadlines_14d,
      emails_sent_total: latest?.emails_sent_total ?? 0,
      replies_total: latest?.replies_total ?? 0,
      last_sync,
      sync_stale,
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
