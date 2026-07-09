import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000)
}

// GET /api/ads
//   (no params)        -> client dropdown list for the media buyer workspace
//   ?client_id=<uuid>   -> last 14 days of client_metrics_daily + targets
//   ?scope=agency        -> last 7 days of agency_ads_daily (house account)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const scope = url.searchParams.get('scope')
    const clientId = url.searchParams.get('client_id')
    const supabase = createSupabaseAdmin()

    if (scope === 'agency') {
      const since = ymd(daysAgo(6))
      const { data, error } = await supabase
        .from('agency_ads_daily')
        .select('date, spend, impressions, clicks, ctr, leads, purchases, revenue')
        .gte('date', since)
        .order('date', { ascending: true })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const rows = data ?? []
      const spend = rows.reduce((s, r) => s + (r.spend ?? 0), 0)
      const leads = rows.reduce((s, r) => s + (r.leads ?? 0), 0)
      const revenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0)
      const cpl = leads > 0 ? spend / leads : null

      return NextResponse.json(
        { rows, summary: { spend, leads, cpl, revenue }, empty: rows.length === 0 },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (!clientId) {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, meta_ad_account_id')
        .is('archived_at', null)
        .order('name', { ascending: true })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ clients: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const since = ymd(daysAgo(13))

    const [{ data: metrics, error: metricsError }, { data: client, error: clientError }] = await Promise.all([
      supabase
        .from('client_metrics_daily')
        .select('date, spend, revenue, roas, purchases, cpa, impressions, clicks, ctr')
        .eq('client_id', clientId)
        .gte('date', since)
        .order('date', { ascending: true }),
      supabase
        .from('clients')
        .select('id, name, meta_ad_account_id, target_roas, target_cpa, monthly_budget')
        .eq('id', clientId)
        .maybeSingle(),
    ])

    if (metricsError) return NextResponse.json({ error: metricsError.message }, { status: 500 })
    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    return NextResponse.json(
      { client, metrics: metrics ?? [], empty: (metrics ?? []).length === 0 },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('[ads/route]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
