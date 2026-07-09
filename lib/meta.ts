// Read-only client for the Meta Marketing API (Graph API v23.0).
// Used by the meta-sync cron to pull per-client and agency ad performance,
// and by the ads recommendations route for a live campaign breakdown.
// Nothing here ever writes back to Meta.

const GRAPH_VERSION = 'v23.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

export type MetaResult<T> = { ok: true; data: T } | { ok: false; error: string }

export type MetaDailyInsight = {
  date: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  purchases: number
  revenue: number
  roas: number | null
  cpa: number | null
  leads: number
}

export type MetaCampaignInsight = {
  campaignName: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  purchases: number
  revenue: number
  roas: number | null
}

export function isMetaConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN)
}

const PURCHASE_ACTION_TYPES = ['omni_purchase', 'purchase']
const LEAD_ACTION_TYPES = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead']

interface MetaActionEntry {
  action_type: string
  value: string
}

interface MetaInsightRow {
  date_start?: string
  campaign_name?: string
  spend?: string
  impressions?: string
  clicks?: string
  ctr?: string
  actions?: MetaActionEntry[]
  action_values?: MetaActionEntry[]
  purchase_roas?: MetaActionEntry[]
}

interface MetaApiResponse {
  data?: MetaInsightRow[]
  error?: { message?: string; type?: string; code?: number }
}

function sumActions(entries: MetaActionEntry[] | undefined, types: string[]): number {
  if (!entries) return 0
  return entries
    .filter((e) => types.includes(e.action_type))
    .reduce((sum, e) => sum + (parseFloat(e.value) || 0), 0)
}

function num(v: string | undefined): number {
  const n = parseFloat(v ?? '')
  return Number.isFinite(n) ? n : 0
}

async function callGraph(path: string, params: Record<string, string>): Promise<MetaResult<MetaInsightRow[]>> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) return { ok: false, error: 'META_ACCESS_TOKEN is not configured' }

  const search = new URLSearchParams({ ...params, access_token: token })

  let res: Response
  try {
    res = await fetch(`${GRAPH_BASE}${path}?${search.toString()}`, { cache: 'no-store' })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error calling Meta API' }
  }

  let json: MetaApiResponse
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: `Meta API returned non-JSON response (status ${res.status})` }
  }

  if (!res.ok || json.error) {
    return { ok: false, error: json.error?.message ?? `Meta API error (status ${res.status})` }
  }

  return { ok: true, data: json.data ?? [] }
}

function rowToDailyInsight(row: MetaInsightRow): MetaDailyInsight {
  const spend = num(row.spend)
  const purchases = sumActions(row.actions, PURCHASE_ACTION_TYPES)
  const leads = sumActions(row.actions, LEAD_ACTION_TYPES)
  const revenue = sumActions(row.action_values, PURCHASE_ACTION_TYPES)

  const roasFromApi = row.purchase_roas?.find((e) => PURCHASE_ACTION_TYPES.includes(e.action_type))
  const roas = roasFromApi
    ? parseFloat(roasFromApi.value) || null
    : spend > 0
      ? revenue / spend
      : null

  return {
    date: row.date_start ?? '',
    spend,
    impressions: Math.round(num(row.impressions)),
    clicks: Math.round(num(row.clicks)),
    ctr: num(row.ctr),
    purchases: Math.round(purchases),
    revenue,
    roas,
    cpa: purchases > 0 ? spend / purchases : null,
    leads: Math.round(leads),
  }
}

// Per-day insights for a single ad account, used to populate
// client_metrics_daily / agency_ads_daily.
export async function fetchAccountInsights(
  accountId: string,
  sinceYYYYMMDD: string,
  untilYYYYMMDD: string,
): Promise<MetaResult<MetaDailyInsight[]>> {
  const res = await callGraph(`/${accountId}/insights`, {
    time_range: JSON.stringify({ since: sinceYYYYMMDD, until: untilYYYYMMDD }),
    time_increment: '1',
    fields: 'spend,impressions,clicks,ctr,actions,action_values,purchase_roas',
  })

  if (!res.ok) return res
  return { ok: true, data: res.data.map(rowToDailyInsight) }
}

// Campaign-level breakdown (aggregated over the window, no daily split) for
// the recommendations engine.
export async function fetchCampaignBreakdown(
  accountId: string,
  sinceYYYYMMDD: string,
  untilYYYYMMDD: string,
): Promise<MetaResult<MetaCampaignInsight[]>> {
  const res = await callGraph(`/${accountId}/insights`, {
    time_range: JSON.stringify({ since: sinceYYYYMMDD, until: untilYYYYMMDD }),
    level: 'campaign',
    fields: 'campaign_name,spend,impressions,clicks,ctr,actions,action_values,purchase_roas',
  })

  if (!res.ok) return res

  const data: MetaCampaignInsight[] = res.data.map((row) => {
    const insight = rowToDailyInsight(row)
    return {
      campaignName: row.campaign_name ?? 'Unnamed campaign',
      spend: insight.spend,
      impressions: insight.impressions,
      clicks: insight.clicks,
      ctr: insight.ctr,
      purchases: insight.purchases,
      revenue: insight.revenue,
      roas: insight.roas,
    }
  })

  return { ok: true, data }
}
