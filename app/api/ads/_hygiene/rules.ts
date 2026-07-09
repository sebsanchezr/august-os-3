// Deterministic account-hygiene rule engine. Pure TS, no I/O, unit-testable.
//
// It runs BEFORE the LLM and its ONLY job is to surface operational / creative
// things the media buyer MISSED: something left on, a paused winner, delivery
// stalls, fatigue. It never gives ad strategy advice (no "scale this", no "test
// new audiences"). Every finding is a "did you mean to do this?" flag with the
// hard metric evidence attached.

import type { MetaAdEntity, MetaEntityLevel } from '@/lib/meta'

export type Severity = 'high' | 'medium' | 'low'

export type HygieneFinding = {
  rule: string
  severity: Severity
  level: MetaEntityLevel
  entityId: string
  entityName: string
  message: string
  evidence: string
}

export type HygieneContext = {
  targetRoas: number | null
  targetCpa: number | null
  currency: string
  // Absolute floor for "meaningful spend" so tiny test budgets never trip
  // currency-based rules. Defaults to 50 (units of account currency).
  spendFloor?: number
}

function money(ctx: HygieneContext, n: number): string {
  return `${ctx.currency}${n.toFixed(2)}`
}

function isActive(e: MetaAdEntity): boolean {
  return e.effectiveStatus === 'ACTIVE'
}

function isPaused(e: MetaAdEntity): boolean {
  return e.effectiveStatus === 'PAUSED'
}

// Effective ROAS for an entity, preferring the live 7d window but falling back
// to the prior week (a just-paused winner may have little spend in the last 7d).
function bestRoas(e: MetaAdEntity): number | null {
  if (e.last7d.spend > 0 && e.last7d.roas !== null) return e.last7d.roas
  if (e.prev7d.spend > 0 && e.prev7d.roas !== null) return e.prev7d.roas
  return null
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function runHygieneRules(entities: MetaAdEntity[], ctx: HygieneContext): HygieneFinding[] {
  const findings: HygieneFinding[] = []
  const floor = ctx.spendFloor ?? 50

  // Account-level context for relative comparisons.
  const ads = entities.filter((e) => e.level === 'ad')
  const totalSpend = ads.reduce((s, e) => s + e.last7d.spend, 0)
  const totalPurchases = ads.reduce((s, e) => s + e.last7d.purchases, 0)
  const accountAvgCpa = totalPurchases > 0 ? totalSpend / totalPurchases : null
  const accountRevenue = ads.reduce((s, e) => s + e.last7d.revenue, 0)
  const accountRoas = totalSpend > 0 ? accountRevenue / totalSpend : null
  // Spend threshold for "burning money": whichever is larger of the floor or
  // 2x the account's average cost per acquisition.
  const spendThreshold = Math.max(floor, accountAvgCpa !== null ? accountAvgCpa * 2 : 0)

  for (const e of entities) {
    // Rule 1 - active entity spending with zero purchases (left running).
    // Applies to adsets and ads (where spend actually lands).
    if (isActive(e) && (e.level === 'adset' || e.level === 'ad')) {
      if (e.last7d.purchases === 0 && e.last7d.spend > spendThreshold) {
        findings.push({
          rule: 'left_on_zero_purchase',
          severity: 'high',
          level: e.level,
          entityId: e.id,
          entityName: e.name,
          message: `Active ${e.level} with real spend and no sales in 7d. Did you mean to leave this on?`,
          evidence: `Spend ${money(ctx, e.last7d.spend)}, 0 purchases (threshold ${money(ctx, spendThreshold)}).`,
        })
      }
    }

    // Rule 2 - paused a winner. Paused entity whose ROAS beat the target.
    if (isPaused(e) && ctx.targetRoas !== null) {
      const roas = bestRoas(e)
      if (roas !== null && roas >= ctx.targetRoas) {
        findings.push({
          rule: 'paused_winner',
          severity: 'high',
          level: e.level,
          entityId: e.id,
          entityName: e.name,
          message: `Paused ${e.level} was beating your ROAS target. Confirm the pause was intentional.`,
          evidence: `ROAS ${roas.toFixed(2)} vs target ${ctx.targetRoas.toFixed(2)}.`,
        })
      }
    }

    // Rule 3 - active, converting, but ROAS far below target while the account
    // as a whole hits target. Candidate to turn off. (purchases > 0 keeps this
    // distinct from rule 1.)
    if (
      isActive(e) &&
      (e.level === 'adset' || e.level === 'ad') &&
      ctx.targetRoas !== null &&
      e.last7d.purchases > 0 &&
      e.last7d.roas !== null &&
      e.last7d.roas < ctx.targetRoas * 0.5 &&
      e.last7d.spend > spendThreshold &&
      accountRoas !== null &&
      accountRoas >= ctx.targetRoas
    ) {
      findings.push({
        rule: 'active_far_below_target',
        severity: 'medium',
        level: e.level,
        entityId: e.id,
        entityName: e.name,
        message: `Active ${e.level} running well under target while the rest of the account performs. Did you mean to leave this on?`,
        evidence: `ROAS ${e.last7d.roas.toFixed(2)} vs target ${ctx.targetRoas.toFixed(2)}, account ROAS ${accountRoas.toFixed(2)}, spend ${money(ctx, e.last7d.spend)}.`,
      })
    }

    // Rule 4 - creative fatigue: frequency over 4 in 7d.
    if (isActive(e) && (e.level === 'adset' || e.level === 'ad') && e.last7d.frequency > 4) {
      findings.push({
        rule: 'frequency_fatigue',
        severity: 'medium',
        level: e.level,
        entityId: e.id,
        entityName: e.name,
        message: `Audience is seeing this a lot. Check whether the creative needs a refresh.`,
        evidence: `Frequency ${e.last7d.frequency.toFixed(2)} in 7d (over 4).`,
      })
    }

    // Rule 6 - active but delivered nothing: 0 impressions in 7d.
    if (isActive(e) && (e.level === 'adset' || e.level === 'ad') && e.last7d.impressions === 0) {
      findings.push({
        rule: 'no_delivery',
        severity: 'high',
        level: e.level,
        entityId: e.id,
        entityName: e.name,
        message: `Active but delivered 0 impressions in 7d. Check for a rejection, empty audience or a learning stall.`,
        evidence: `0 impressions, effective_status ACTIVE.`,
      })
    }

    // Rule 8 - spend scaled up while ROAS fell week over week.
    if (
      isActive(e) &&
      (e.level === 'adset' || e.level === 'ad') &&
      e.prev7d.spend > 0 &&
      e.last7d.spend > e.prev7d.spend * 1.5 &&
      e.last7d.roas !== null &&
      e.prev7d.roas !== null &&
      e.last7d.roas < e.prev7d.roas
    ) {
      const pct = ((e.last7d.spend / e.prev7d.spend - 1) * 100).toFixed(0)
      findings.push({
        rule: 'spend_up_roas_down',
        severity: 'medium',
        level: e.level,
        entityId: e.id,
        entityName: e.name,
        message: `Spend jumped week over week while ROAS dropped. Check this is scaling in the right direction.`,
        evidence: `Spend +${pct}% (${money(ctx, e.prev7d.spend)} to ${money(ctx, e.last7d.spend)}), ROAS ${e.prev7d.roas.toFixed(2)} to ${e.last7d.roas.toFixed(2)}.`,
      })
    }
  }

  // Rule 5 - duplicate / overlapping adset names (possible audience overlap).
  const adsetsByName = new Map<string, MetaAdEntity[]>()
  for (const e of entities) {
    if (e.level !== 'adset') continue
    const key = e.name.trim().toLowerCase()
    const list = adsetsByName.get(key) ?? []
    list.push(e)
    adsetsByName.set(key, list)
  }
  for (const [, group] of adsetsByName) {
    const active = group.filter(isActive)
    if (active.length > 1) {
      // Flag once, on the first duplicate, to avoid N near-identical findings.
      const e = active[0]
      findings.push({
        rule: 'duplicate_adset_name',
        severity: 'low',
        level: 'adset',
        entityId: e.id,
        entityName: e.name,
        message: `Multiple active ad sets share this name. Check they are not overlapping the same audience.`,
        evidence: `${active.length} active ad sets named "${e.name}".`,
      })
    }
  }

  // Rule 7 - daily budget outlier vs siblings in the same campaign.
  const adsetsByCampaign = new Map<string, MetaAdEntity[]>()
  for (const e of entities) {
    if (e.level !== 'adset' || e.dailyBudget === null || !e.campaignId) continue
    const list = adsetsByCampaign.get(e.campaignId) ?? []
    list.push(e)
    adsetsByCampaign.set(e.campaignId, list)
  }
  for (const [, siblings] of adsetsByCampaign) {
    if (siblings.length < 3) continue
    const budgets = siblings.map((s) => s.dailyBudget as number)
    const med = median(budgets)
    if (med <= 0) continue
    for (const e of siblings) {
      const b = e.dailyBudget as number
      if (b > med * 3) {
        findings.push({
          rule: 'budget_outlier',
          severity: 'low',
          level: 'adset',
          entityId: e.id,
          entityName: e.name,
          message: `Daily budget is far above its sibling ad sets. Confirm this is intended.`,
          evidence: `Budget ${money(ctx, b)} vs median ${money(ctx, med)} across ${siblings.length} ad sets in the campaign.`,
        })
      }
    }
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity])
}
