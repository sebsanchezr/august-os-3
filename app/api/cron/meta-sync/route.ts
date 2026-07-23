import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { metaTokenCandidates, fetchAccountInsightsAnyToken } from '@/lib/meta'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET/POST /api/cron/meta-sync
// Runs daily (see vercel.json). Pulls the last 3 days of Meta Marketing API
// insights for every non-archived client with a meta_ad_account_id and
// upserts them into client_metrics_daily, so the ads workspace and the
// existing metrics-staleness cron both have fresh numbers to read. A 3-day
// window (not just "today") absorbs Meta's own attribution backfill, where
// yesterday's numbers can still shift for a day or two after the fact.
// If AGENCY_META_AD_ACCOUNT_ID is set, the agency's own house ad account is
// synced the same way into agency_ads_daily for the Acquisition dashboard.
export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (metaTokenCandidates().length === 0) {
    return NextResponse.json({ skipped: true, reason: 'No Meta access token configured' })
  }

  const supabase = createSupabaseAdmin()

  const today = new Date()
  const since = ymd(new Date(today.getTime() - 2 * 86400000))
  const until = ymd(today)
  const nowIso = new Date().toISOString()

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, meta_ad_account_id')
    .is('archived_at', null)
    .not('meta_ad_account_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { client_id: string; name: string; rows_synced: number }[] = []
  const errors: { client_id: string; name: string; error: string }[] = []

  for (const client of clients ?? []) {
    if (!client.meta_ad_account_id) continue

    const insights = await fetchAccountInsightsAnyToken(client.meta_ad_account_id, since, until)
    if (!insights.ok) {
      errors.push({ client_id: client.id, name: client.name, error: insights.error })
      continue
    }

    const rows = insights.data.map((d) => ({
      client_id: client.id,
      date: d.date,
      spend: d.spend,
      revenue: d.revenue,
      roas: d.roas,
      purchases: d.purchases,
      cpa: d.cpa,
      impressions: d.impressions,
      clicks: d.clicks,
      ctr: d.ctr,
      updated_at: nowIso,
    }))

    if (rows.length === 0) {
      results.push({ client_id: client.id, name: client.name, rows_synced: 0 })
      continue
    }

    const { error: upsertError } = await supabase
      .from('client_metrics_daily')
      .upsert(rows, { onConflict: 'client_id,date' })

    if (upsertError) {
      errors.push({ client_id: client.id, name: client.name, error: upsertError.message })
      continue
    }

    results.push({ client_id: client.id, name: client.name, rows_synced: rows.length })
  }

  let agency: { synced: boolean; rows_synced?: number; error?: string } = { synced: false }

  const agencyAccountId = process.env.AGENCY_META_AD_ACCOUNT_ID
  if (agencyAccountId) {
    const agencyInsights = await fetchAccountInsightsAnyToken(agencyAccountId, since, until)
    if (!agencyInsights.ok) {
      agency = { synced: false, error: agencyInsights.error }
    } else {
      const agencyRows = agencyInsights.data.map((d) => ({
        date: d.date,
        spend: d.spend,
        impressions: d.impressions,
        clicks: d.clicks,
        ctr: d.ctr,
        leads: d.leads,
        purchases: d.purchases,
        revenue: d.revenue,
        synced_at: nowIso,
      }))

      if (agencyRows.length > 0) {
        const { error: agencyError } = await supabase
          .from('agency_ads_daily')
          .upsert(agencyRows, { onConflict: 'date' })

        agency = agencyError
          ? { synced: false, error: agencyError.message }
          : { synced: true, rows_synced: agencyRows.length }
      } else {
        agency = { synced: true, rows_synced: 0 }
      }
    }
  }

  return NextResponse.json({
    clients_checked: clients?.length ?? 0,
    results,
    errors,
    agency,
  })
}
