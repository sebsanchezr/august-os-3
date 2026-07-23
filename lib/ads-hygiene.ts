// Server-only: deterministic ads hygiene / miss-detection for media buyers.
// Imported by API routes only.
//
// This is NOT ad strategy. It reads whatever ads / metrics tables the OS
// actually has and surfaces things a media buyer may have MISSED: stale data,
// connected accounts with no spend, spend still landing on a paused / archived
// client, creative that looks fatigued (CTR falling week over week), an account
// running under its own ROAS target, or a client flagged red that is still
// spending. Every check is a "did you mean this?" flag with the hard numbers
// attached. It never fabricates: when there is no data it says so.

import type { SupabaseClient } from '@supabase/supabase-js'

export type CheckSeverity = 'high' | 'medium' | 'low'

export type HygieneCheck = {
  key: string
  severity: CheckSeverity
  title: string
  detail: string
  affected: Array<Record<string, unknown>>
}

export type AdsHygieneResult = {
  data_as_of: string | null
  checks: HygieneCheck[]
  meta_token_dead: boolean
  scanned_clients: number
}

type ClientRow = {
  id: string
  name: string
  status: string | null
  health: string | null
  meta_ad_account_id: string | null
  archived_at: string | null
  target_roas: number | null
}

type MetricRow = {
  client_id: string
  date: string
  spend: number | null
  revenue: number | null
  roas: number | null
  impressions: number | null
  ctr: number | null
}

const DAY_MS = 86400000

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS)
}

function money(n: number): string {
  return `£${n.toFixed(2)}`
}

// Whether to frame ingested numbers as potentially stale. The daily meta-health
// cron sets META_TOKEN_LIVE=1 once a valid token is confirmed; a missing token
// is treated as dead so the framing stays honest.
function metaTokenDead(): boolean {
  return process.env.META_TOKEN_LIVE !== '1'
}

export async function runAdsHygiene(
  supabase: SupabaseClient,
  clientId?: string | null,
): Promise<AdsHygieneResult> {
  // ── Scope: one client or the whole book ─────────────────────────────────────
  let clientQuery = supabase
    .from('clients')
    .select('id, name, status, health, meta_ad_account_id, archived_at, target_roas')
  if (clientId) clientQuery = clientQuery.eq('id', clientId)
  const { data: clientsData } = await clientQuery
  const clients: ClientRow[] = (clientsData ?? []) as ClientRow[]

  const clientIds = clients.map((c) => c.id)
  const checks: HygieneCheck[] = []

  if (clientIds.length === 0) {
    return { data_as_of: null, checks, meta_token_dead: metaTokenDead(), scanned_clients: 0 }
  }

  // ── Pull the last 28 days of daily metrics for the scope ────────────────────
  const since = ymd(new Date(Date.now() - 28 * DAY_MS))
  const { data: metricsData } = await supabase
    .from('client_metrics_daily')
    .select('client_id, date, spend, revenue, roas, impressions, ctr')
    .in('client_id', clientIds)
    .gte('date', since)
    .order('date', { ascending: true })
  const metrics: MetricRow[] = (metricsData ?? []) as MetricRow[]

  const byClient = new Map<string, MetricRow[]>()
  for (const m of metrics) {
    const list = byClient.get(m.client_id) ?? []
    list.push(m)
    byClient.set(m.client_id, list)
  }

  const nameOf = new Map(clients.map((c) => [c.id, c.name]))
  const today = ymd(new Date())

  // data_as_of: the most recent metrics date anywhere in scope.
  let dataAsOf: string | null = null
  for (const m of metrics) {
    if (!dataAsOf || m.date > dataAsOf) dataAsOf = m.date
  }

  // Latest metrics date per client (for staleness).
  const latestDate = new Map<string, string>()
  for (const [cid, rows] of byClient) {
    latestDate.set(cid, rows[rows.length - 1].date)
  }

  // ── Check: stale data (latest metrics older than 3 days) ────────────────────
  const stale = clients
    .filter((c) => latestDate.has(c.id) && daysBetween(latestDate.get(c.id)!, today) > 3)
    .map((c) => ({ client_id: c.id, client_name: c.name, last_data: latestDate.get(c.id)!, days_old: daysBetween(latestDate.get(c.id)!, today) }))
  if (stale.length > 0) {
    checks.push({
      key: 'stale_data',
      severity: 'high',
      title: 'Metrics data is stale',
      detail: `${stale.length} client${stale.length === 1 ? '' : 's'} have no fresh performance data in the last 3 days. Ingestion may have stalled (reporter down, or the ad account is no longer shared). Treat the numbers below as of their last data date, not live.`,
      affected: stale,
    })
  }

  // ── Check: connected client with no metrics at all ──────────────────────────
  const connectedNoData = clients
    .filter((c) => (c.status ?? 'active') === 'active' && c.meta_ad_account_id && !byClient.has(c.id))
    .map((c) => ({ client_id: c.id, client_name: c.name, meta_ad_account_id: c.meta_ad_account_id }))
  if (connectedNoData.length > 0) {
    checks.push({
      key: 'connected_no_metrics',
      severity: 'medium',
      title: 'Connected account has no data',
      detail: 'These clients have a Meta ad account on file but no performance rows have ever been ingested. Check the reporter is pulling this account.',
      affected: connectedNoData,
    })
  }

  // ── Per client numeric checks over the metrics window ────────────────────────
  const zeroSpend: Array<Record<string, unknown>> = []
  const spendAfterPause: Array<Record<string, unknown>> = []
  const ctrDecline: Array<Record<string, unknown>> = []
  const roasBelowTarget: Array<Record<string, unknown>> = []
  const redSpending: Array<Record<string, unknown>> = []

  for (const c of clients) {
    const rows = byClient.get(c.id) ?? []
    if (rows.length === 0) continue
    const last7 = rows.slice(-7)
    const prev7 = rows.slice(-14, -7)
    const sum = (rs: MetricRow[], k: keyof MetricRow) => rs.reduce((s, r) => s + (Number(r[k]) || 0), 0)
    const spend7 = sum(last7, 'spend')
    const revenue7 = sum(last7, 'revenue')
    const impressions7 = sum(last7, 'impressions')
    const isActive = (c.status ?? 'active') === 'active'
    const isPaused = !isActive || c.archived_at !== null

    // Connected + active but zero spend in the latest 7 data days.
    if (isActive && c.meta_ad_account_id && spend7 === 0) {
      zeroSpend.push({ client_id: c.id, client_name: c.name, days_checked: last7.length })
    }

    // Spend still landing on a paused / archived client.
    if (isPaused) {
      const cutoff = c.archived_at ? c.archived_at.slice(0, 10) : since
      const spending = rows.filter((r) => r.date > cutoff && (Number(r.spend) || 0) > 0)
      const spentAfter = spending.reduce((s, r) => s + (Number(r.spend) || 0), 0)
      if (spending.length > 0) {
        spendAfterPause.push({
          client_id: c.id,
          client_name: c.name,
          status: c.status,
          pause_date: c.archived_at ? c.archived_at.slice(0, 10) : null,
          spend_since: money(spentAfter),
          last_spend_date: spending[spending.length - 1].date,
        })
      }
    }

    // CTR falling week over week (creative fatigue proxy).
    const avgCtr = (rs: MetricRow[]) => {
      const withCtr = rs.filter((r) => r.ctr !== null)
      if (withCtr.length === 0) return null
      return withCtr.reduce((s, r) => s + (Number(r.ctr) || 0), 0) / withCtr.length
    }
    const ctrNow = avgCtr(last7)
    const ctrPrev = avgCtr(prev7)
    if (ctrNow !== null && ctrPrev !== null && ctrPrev > 0 && impressions7 > 0 && ctrNow < ctrPrev * 0.7) {
      const drop = ((1 - ctrNow / ctrPrev) * 100).toFixed(0)
      ctrDecline.push({
        client_id: c.id,
        client_name: c.name,
        ctr_last7: `${ctrNow.toFixed(2)}%`,
        ctr_prev7: `${ctrPrev.toFixed(2)}%`,
        drop_pct: `${drop}%`,
      })
    }

    // Account running under its own ROAS target for the last 7 data days.
    if (isActive && c.target_roas !== null && spend7 > 0) {
      const roas7 = revenue7 / spend7
      if (roas7 < c.target_roas) {
        roasBelowTarget.push({
          client_id: c.id,
          client_name: c.name,
          roas_7d: roas7.toFixed(2),
          target_roas: c.target_roas.toFixed(2),
          spend_7d: money(spend7),
        })
      }
    }

    // Client flagged red but ads are still live and spending.
    if (isActive && c.health === 'red' && spend7 > 0) {
      redSpending.push({ client_id: c.id, client_name: c.name, spend_7d: money(spend7) })
    }
  }

  if (spendAfterPause.length > 0) {
    checks.push({
      key: 'spend_after_pause',
      severity: 'high',
      title: 'Spend on a paused or archived client',
      detail: 'These clients are paused or archived in the OS but still show ad spend. Confirm the ads were switched off, or the money is being wasted.',
      affected: spendAfterPause,
    })
  }
  if (zeroSpend.length > 0) {
    checks.push({
      key: 'active_zero_spend',
      severity: 'medium',
      title: 'Connected account, no recent spend',
      detail: 'Active clients with a connected Meta account but zero spend across the latest days of data. Check delivery has not stalled or been paused by mistake.',
      affected: zeroSpend,
    })
  }
  if (ctrDecline.length > 0) {
    checks.push({
      key: 'ctr_decline',
      severity: 'medium',
      title: 'CTR falling week over week',
      detail: 'Click through rate dropped more than 30 percent versus the previous 7 days of data. The creative may be fatiguing and due a refresh.',
      affected: ctrDecline,
    })
  }
  if (redSpending.length > 0) {
    checks.push({
      key: 'health_red_spending',
      severity: 'medium',
      title: 'Red health client still spending',
      detail: 'These clients are flagged red in the OS but ads are still live and spending. Confirm this is intended before more budget goes out.',
      affected: redSpending,
    })
  }
  if (roasBelowTarget.length > 0) {
    checks.push({
      key: 'roas_below_target',
      severity: 'low',
      title: 'Account under its ROAS target',
      detail: 'Last 7 data days came in below the account target ROAS. Flagged so it is not missed, not as a strategy call.',
      affected: roasBelowTarget,
    })
  }

  // ── Optional entity-level checks if ad_entities_snapshot has data ────────────
  // The Meta token is dead so this table is usually empty, but if a snapshot is
  // ever present we run a few operational checks over the latest one.
  try {
    let snapQuery = supabase
      .from('ad_entities_snapshot')
      .select('client_id, snapshot_date, level, entity_name, effective_status, spend_7d, purchases_7d, frequency')
      .order('snapshot_date', { ascending: false })
      .limit(500)
    if (clientId) snapQuery = snapQuery.eq('client_id', clientId)
    const { data: snapData, error: snapErr } = await snapQuery
    if (!snapErr && Array.isArray(snapData) && snapData.length > 0) {
      type Snap = {
        client_id: string
        snapshot_date: string
        level: string
        entity_name: string
        effective_status: string
        spend_7d: number | null
        purchases_7d: number | null
        frequency: number | null
      }
      // Keep only the most recent snapshot_date per client.
      const latestSnapDate = new Map<string, string>()
      for (const s of snapData as Snap[]) {
        const cur = latestSnapDate.get(s.client_id)
        if (!cur || s.snapshot_date > cur) latestSnapDate.set(s.client_id, s.snapshot_date)
      }
      const current = (snapData as Snap[]).filter((s) => latestSnapDate.get(s.client_id) === s.snapshot_date)

      const zeroSalesSpend = current
        .filter((s) => s.level !== 'campaign' && s.effective_status === 'ACTIVE' && (Number(s.spend_7d) || 0) > 50 && (Number(s.purchases_7d) || 0) === 0)
        .map((s) => ({ client_id: s.client_id, client_name: nameOf.get(s.client_id) ?? s.client_id, entity: s.entity_name, spend_7d: money(Number(s.spend_7d) || 0) }))
      if (zeroSalesSpend.length > 0) {
        checks.push({
          key: 'entity_spend_no_sales',
          severity: 'high',
          title: 'Active ad spending with no sales',
          detail: 'Active ads or ad sets with real spend and zero purchases in the last 7 days. Confirm they should still be on.',
          affected: zeroSalesSpend,
        })
      }

      const fatigued = current
        .filter((s) => s.effective_status === 'ACTIVE' && (Number(s.frequency) || 0) > 4)
        .map((s) => ({ client_id: s.client_id, client_name: nameOf.get(s.client_id) ?? s.client_id, entity: s.entity_name, frequency: (Number(s.frequency) || 0).toFixed(2) }))
      if (fatigued.length > 0) {
        checks.push({
          key: 'entity_frequency_fatigue',
          severity: 'medium',
          title: 'High frequency, possible fatigue',
          detail: 'Active ads or ad sets with frequency above 4 in the last 7 days. The audience is seeing these a lot, check whether the creative needs a refresh.',
          affected: fatigued,
        })
      }

      // Duplicate active ad names (possible accidental duplicates).
      const activeAds = current.filter((s) => s.level === 'ad' && s.effective_status === 'ACTIVE')
      const nameGroups = new Map<string, Snap[]>()
      for (const s of activeAds) {
        const k = `${s.client_id}::${s.entity_name.trim().toLowerCase()}`
        const list = nameGroups.get(k) ?? []
        list.push(s)
        nameGroups.set(k, list)
      }
      const dupes: Array<Record<string, unknown>> = []
      for (const [, group] of nameGroups) {
        if (group.length > 1) {
          dupes.push({ client_id: group[0].client_id, client_name: nameOf.get(group[0].client_id) ?? group[0].client_id, entity: group[0].entity_name, count: group.length })
        }
      }
      if (dupes.length > 0) {
        checks.push({
          key: 'entity_duplicate_active_name',
          severity: 'low',
          title: 'Duplicate active ad names',
          detail: 'Multiple active ads share the exact same name. Check they are not accidental duplicates competing for the same audience.',
          affected: dupes,
        })
      }
    }
  } catch {
    // ad_entities_snapshot missing or unreadable: entity checks are simply skipped.
  }

  const rank: Record<CheckSeverity, number> = { high: 0, medium: 1, low: 2 }
  checks.sort((a, b) => rank[a.severity] - rank[b.severity])

  return { data_as_of: dataAsOf, checks, meta_token_dead: metaTokenDead(), scanned_clients: clients.length }
}
