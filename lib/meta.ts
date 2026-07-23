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

export type MetaEntityLevel = 'campaign' | 'adset' | 'ad'

export type MetaEntityInsights = {
  spend: number
  purchases: number
  revenue: number
  roas: number | null
  ctr: number
  impressions: number
  frequency: number
}

// A single campaign / adset / ad with its operational state (effective_status,
// budget) plus last-7d and prev-7d insights. This is what the hygiene rule
// engine reads: without effective_status and per-entity spend, checks like
// "ad set left running with no sales" or "paused a winner" are impossible.
export type MetaAdEntity = {
  level: MetaEntityLevel
  id: string
  name: string
  effectiveStatus: string
  dailyBudget: number | null
  lifetimeBudget: number | null
  campaignId: string | null
  adsetId: string | null
  last7d: MetaEntityInsights
  prev7d: MetaEntityInsights
}

export function isMetaConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN)
}

// Dev-only escape hatch: when MOCK_META=1 the recommendations flow uses a
// bundled fixture instead of calling Meta, so the whole press-button flow can
// be demoed while the access token is dead / being re-authed.
export function isMetaMock(): boolean {
  return process.env.MOCK_META === '1'
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

// ─── Token health ───────────────────────────────────────────────────────────
// Hits the Graph debug_token endpoint to check the configured token is still
// valid. A system-user token has expires_at === 0 (never expires); a user token
// carries a real unix expiry we can warn on before it lapses.

export type MetaTokenHealth = {
  valid: boolean
  type: string | null          // 'SYSTEM_USER' | 'USER' | ...
  appId: string | null
  scopes: string[]
  expiresAt: number            // unix seconds, 0 = never
  daysUntilExpiry: number | null
  error: string | null
}

export async function checkMetaTokenHealth(): Promise<MetaTokenHealth> {
  const token = process.env.META_ACCESS_TOKEN
  const base: MetaTokenHealth = {
    valid: false, type: null, appId: null, scopes: [], expiresAt: 0, daysUntilExpiry: null, error: null,
  }
  if (!token) return { ...base, error: 'META_ACCESS_TOKEN is not configured' }

  let res: Response
  try {
    res = await fetch(
      `${GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    )
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : 'Network error calling Meta API' }
  }

  let json: { data?: { is_valid?: boolean; type?: string; app_id?: string; scopes?: string[]; expires_at?: number }; error?: { message?: string } }
  try {
    json = await res.json()
  } catch {
    return { ...base, error: `Meta API returned non-JSON response (status ${res.status})` }
  }

  if (json.error) return { ...base, error: json.error.message ?? 'Meta API error' }

  const d = json.data ?? {}
  const expiresAt = d.expires_at ?? 0
  const daysUntilExpiry = expiresAt > 0 ? Math.floor((expiresAt * 1000 - Date.now()) / 86400000) : null
  return {
    valid: Boolean(d.is_valid),
    type: d.type ?? null,
    appId: d.app_id ?? null,
    scopes: d.scopes ?? [],
    expiresAt,
    daysUntilExpiry,
    error: d.is_valid ? null : 'Token reported invalid by Meta',
  }
}

// Returns the raw account ids (no act_ prefix) the configured token can actually
// read. Used by the health cron to catch clients whose ad account has not been
// shared with our system user, which is the silent cause of "connected but no
// data" when ingestion runs server-side.
export async function listAccessibleAdAccountIds(): Promise<MetaResult<Set<string>>> {
  const res = await graphGetAll<{ account_id?: string }>(`/me/adaccounts`, { fields: 'account_id' })
  if (!res.ok) return res
  const ids = new Set<string>()
  for (const row of res.data) {
    if (row.account_id) ids.add(row.account_id.replace(/^act_/, ''))
  }
  return { ok: true, data: ids }
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
  const res = await callGraph(`/${withActPrefix(accountId)}/insights`, {
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
  const res = await callGraph(`/${withActPrefix(accountId)}/insights`, {
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

// ─── Entity-level (campaign / adset / ad) fetch ─────────────────────────────
// Meta stores ad-account ids without the graph "act_" prefix in some places
// (clients.meta_ad_account_id holds raw numeric ids). Normalise so callers can
// pass either form.
function withActPrefix(accountId: string): string {
  return accountId.startsWith('act_') ? accountId : `act_${accountId}`
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

interface GraphEdgeRow {
  id?: string
  name?: string
  effective_status?: string
  daily_budget?: string
  lifetime_budget?: string
  campaign_id?: string
  adset_id?: string
}

interface GraphInsightRow extends MetaInsightRow {
  campaign_id?: string
  adset_id?: string
  ad_id?: string
  frequency?: string
}

interface GraphPagedResponse<T> {
  data?: T[]
  paging?: { next?: string; cursors?: { after?: string } }
  error?: { message?: string; type?: string; code?: number }
}

// Follows paging.next until exhausted (capped) and returns every row. Any page
// failure aborts with the error, so partial data never masquerades as complete.
async function graphGetAll<T>(path: string, params: Record<string, string>): Promise<MetaResult<T[]>> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) return { ok: false, error: 'META_ACCESS_TOKEN is not configured' }

  const rows: T[] = []
  let url: string | null = `${GRAPH_BASE}${path}?${new URLSearchParams({ ...params, limit: '200', access_token: token }).toString()}`
  let guard = 0

  while (url && guard < 25) {
    guard += 1
    let res: Response
    try {
      res = await fetch(url, { cache: 'no-store' })
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error calling Meta API' }
    }

    let json: GraphPagedResponse<T>
    try {
      json = await res.json()
    } catch {
      return { ok: false, error: `Meta API returned non-JSON response (status ${res.status})` }
    }

    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `Meta API error (status ${res.status})` }
    }

    rows.push(...(json.data ?? []))
    url = json.paging?.next ?? null
  }

  return { ok: true, data: rows }
}

function minorToMajor(v: string | undefined): number | null {
  if (v === undefined) return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n / 100 : null
}

function rowToEntityInsights(row: GraphInsightRow): MetaEntityInsights {
  const daily = rowToDailyInsight(row)
  return {
    spend: daily.spend,
    purchases: daily.purchases,
    revenue: daily.revenue,
    roas: daily.roas,
    ctr: daily.ctr,
    impressions: daily.impressions,
    frequency: num(row.frequency),
  }
}

const ZERO_INSIGHTS: MetaEntityInsights = {
  spend: 0, purchases: 0, revenue: 0, roas: null, ctr: 0, impressions: 0, frequency: 0,
}

const ENTITY_EDGE: Record<MetaEntityLevel, { edge: string; fields: string; idKey: keyof GraphInsightRow }> = {
  campaign: { edge: 'campaigns', fields: 'id,name,effective_status,daily_budget,lifetime_budget', idKey: 'campaign_id' },
  adset: { edge: 'adsets', fields: 'id,name,effective_status,daily_budget,lifetime_budget,campaign_id', idKey: 'adset_id' },
  ad: { edge: 'ads', fields: 'id,name,effective_status,adset_id,campaign_id', idKey: 'ad_id' },
}

async function fetchLevelInsights(
  account: string,
  level: MetaEntityLevel,
  since: string,
  until: string,
): Promise<MetaResult<Map<string, MetaEntityInsights>>> {
  const res = await graphGetAll<GraphInsightRow>(`/${account}/insights`, {
    time_range: JSON.stringify({ since, until }),
    level,
    fields: 'spend,impressions,clicks,ctr,frequency,actions,action_values,purchase_roas',
  })
  if (!res.ok) return res

  const idKey = ENTITY_EDGE[level].idKey
  const map = new Map<string, MetaEntityInsights>()
  for (const row of res.data) {
    const id = row[idKey] as string | undefined
    if (id) map.set(id, rowToEntityInsights(row))
  }
  return { ok: true, data: map }
}

// Pulls every campaign, adset and ad for an account, each with its
// effective_status + budget and both the last-7d and prev-7d insight windows.
// This is the operational picture the account-level daily table cannot provide.
export async function fetchAdEntities(adAccountId: string): Promise<MetaResult<MetaAdEntity[]>> {
  const account = withActPrefix(adAccountId)

  const now = new Date()
  const last7Since = ymd(new Date(now.getTime() - 6 * 86400000))
  const last7Until = ymd(now)
  const prev7Since = ymd(new Date(now.getTime() - 13 * 86400000))
  const prev7Until = ymd(new Date(now.getTime() - 7 * 86400000))

  const entities: MetaAdEntity[] = []

  for (const level of ['campaign', 'adset', 'ad'] as MetaEntityLevel[]) {
    const cfg = ENTITY_EDGE[level]

    const edgeRes = await graphGetAll<GraphEdgeRow>(`/${account}/${cfg.edge}`, { fields: cfg.fields })
    if (!edgeRes.ok) return edgeRes

    const [last7, prev7] = await Promise.all([
      fetchLevelInsights(account, level, last7Since, last7Until),
      fetchLevelInsights(account, level, prev7Since, prev7Until),
    ])
    if (!last7.ok) return last7
    if (!prev7.ok) return prev7

    for (const row of edgeRes.data) {
      const id = row.id
      if (!id) continue
      entities.push({
        level,
        id,
        name: row.name ?? '(unnamed)',
        effectiveStatus: row.effective_status ?? 'UNKNOWN',
        dailyBudget: minorToMajor(row.daily_budget),
        lifetimeBudget: minorToMajor(row.lifetime_budget),
        campaignId: row.campaign_id ?? null,
        adsetId: row.adset_id ?? null,
        last7d: last7.data.get(id) ?? { ...ZERO_INSIGHTS },
        prev7d: prev7.data.get(id) ?? { ...ZERO_INSIGHTS },
      })
    }
  }

  return { ok: true, data: entities }
}
