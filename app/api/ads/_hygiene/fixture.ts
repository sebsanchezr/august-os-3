// Realistic mock of an ad account for demoing the hygiene flow end to end while
// the Meta access token is dead. 3 campaigns, 8 ad sets, 15 ads.
//
// Exactly three problems are planted, and the account is otherwise clean so the
// rule engine's output is deterministic:
//   1. Ad set "Broad Cold" is ACTIVE, spent money, made zero sales (left on).
//   2. Ad set "Retargeting 30d" is PAUSED but was beating the ROAS target
//      (paused winner).
//   3. Ad "UGC Testimonial v3" is ACTIVE with a 7d frequency of 5.4 (fatigue).

import type { MetaAdEntity, MetaEntityLevel, MetaEntityInsights } from '@/lib/meta'

function ins(
  spend: number,
  purchases: number,
  revenue: number,
  ctr: number,
  impressions: number,
  frequency: number,
): MetaEntityInsights {
  return { spend, purchases, revenue, roas: spend > 0 ? revenue / spend : null, ctr, impressions, frequency }
}

type EntitySeed = {
  level: MetaEntityLevel
  id: string
  name: string
  status: string
  daily?: number | null
  campaignId?: string | null
  adsetId?: string | null
  last: MetaEntityInsights
  prev: MetaEntityInsights
}

function build(s: EntitySeed): MetaAdEntity {
  return {
    level: s.level,
    id: s.id,
    name: s.name,
    effectiveStatus: s.status,
    dailyBudget: s.daily ?? null,
    lifetimeBudget: null,
    campaignId: s.campaignId ?? null,
    adsetId: s.adsetId ?? null,
    last7d: s.last,
    prev7d: s.prev,
  }
}

const seeds: EntitySeed[] = [
  // ── Campaigns ──────────────────────────────────────────────────────────
  { level: 'campaign', id: 'camp_1', name: 'Prospecting', status: 'ACTIVE', last: ins(530, 13, 1900, 1.4, 128000, 0), prev: ins(500, 12, 1780, 1.4, 122000, 0) },
  { level: 'campaign', id: 'camp_2', name: 'Retargeting', status: 'ACTIVE', last: ins(180, 10, 880, 2.1, 35000, 0), prev: ins(300, 16, 1300, 2.1, 55000, 0) },
  { level: 'campaign', id: 'camp_3', name: 'Testing', status: 'ACTIVE', last: ins(120, 4, 420, 1.2, 35000, 0), prev: ins(113, 4, 400, 1.2, 33000, 0) },

  // ── Ad sets ────────────────────────────────────────────────────────────
  // (1) LEFT ON: active, real spend, zero sales.
  { level: 'adset', id: 'as_1', name: 'Broad Cold', status: 'ACTIVE', daily: 40, campaignId: 'camp_1', last: ins(180, 0, 0, 1.1, 40000, 2.1), prev: ins(170, 0, 0, 1.1, 38000, 2.0) },
  { level: 'adset', id: 'as_2', name: 'Lookalike 3%', status: 'ACTIVE', daily: 45, campaignId: 'camp_1', last: ins(200, 8, 900, 1.6, 50000, 2.5), prev: ins(190, 7, 800, 1.6, 47000, 2.4) },
  { level: 'adset', id: 'as_3', name: 'Interest Stack', status: 'ACTIVE', daily: 40, campaignId: 'camp_1', last: ins(150, 5, 640, 1.5, 38000, 2.0), prev: ins(140, 5, 560, 1.5, 36000, 2.0) },
  // (2) PAUSED WINNER: paused now, prior week ROAS 6.0 vs target 3.0.
  { level: 'adset', id: 'as_4', name: 'Retargeting 30d', status: 'PAUSED', daily: 40, campaignId: 'camp_2', last: ins(0, 0, 0, 0, 0, 0), prev: ins(120, 20, 720, 2.4, 24000, 3.0) },
  { level: 'adset', id: 'as_5', name: 'Retargeting 7d', status: 'ACTIVE', daily: 35, campaignId: 'camp_2', last: ins(100, 6, 500, 2.3, 20000, 3.5), prev: ins(95, 6, 456, 2.3, 19000, 3.4) },
  { level: 'adset', id: 'as_6', name: 'Cart Abandoners', status: 'ACTIVE', daily: 30, campaignId: 'camp_2', last: ins(80, 4, 380, 2.5, 15000, 3.2), prev: ins(78, 4, 360, 2.5, 14000, 3.1) },
  { level: 'adset', id: 'as_7', name: 'Creative Test A', status: 'ACTIVE', daily: 30, campaignId: 'camp_3', last: ins(60, 2, 200, 1.2, 18000, 1.8), prev: ins(55, 2, 176, 1.2, 17000, 1.7) },
  { level: 'adset', id: 'as_8', name: 'Creative Test B', status: 'ACTIVE', daily: 30, campaignId: 'camp_3', last: ins(60, 2, 210, 1.3, 17000, 1.9), prev: ins(58, 2, 200, 1.3, 16000, 1.8) },

  // ── Ads ────────────────────────────────────────────────────────────────
  // Children of the left-on ad set: each below the "burning money" threshold,
  // so only the ad set itself flags (not every child).
  { level: 'ad', id: 'ad_1', name: 'Broad Static 1', status: 'ACTIVE', campaignId: 'camp_1', adsetId: 'as_1', last: ins(40, 0, 0, 1.1, 20000, 2.0), prev: ins(38, 0, 0, 1.1, 19000, 1.9) },
  { level: 'ad', id: 'ad_2', name: 'Broad Static 2', status: 'ACTIVE', campaignId: 'camp_1', adsetId: 'as_1', last: ins(40, 0, 0, 1.0, 20000, 2.2), prev: ins(38, 0, 0, 1.0, 19000, 2.1) },
  { level: 'ad', id: 'ad_3', name: 'LAL Video A', status: 'ACTIVE', campaignId: 'camp_1', adsetId: 'as_2', last: ins(110, 5, 560, 1.7, 26000, 2.4), prev: ins(105, 5, 504, 1.7, 25000, 2.3) },
  { level: 'ad', id: 'ad_4', name: 'LAL Video B', status: 'ACTIVE', campaignId: 'camp_1', adsetId: 'as_2', last: ins(90, 3, 340, 1.5, 24000, 2.6), prev: ins(85, 3, 320, 1.5, 22000, 2.5) },
  { level: 'ad', id: 'ad_5', name: 'Interest Carousel', status: 'ACTIVE', campaignId: 'camp_1', adsetId: 'as_3', last: ins(80, 3, 360, 1.6, 20000, 2.0), prev: ins(75, 3, 320, 1.6, 19000, 2.0) },
  { level: 'ad', id: 'ad_6', name: 'Interest Static', status: 'ACTIVE', campaignId: 'camp_1', adsetId: 'as_3', last: ins(70, 2, 280, 1.4, 18000, 2.0), prev: ins(65, 2, 250, 1.4, 17000, 2.0) },
  // Children of the paused winner: paused, prior ROAS 2.5 (under target), so
  // they do NOT themselves flag as paused winners.
  { level: 'ad', id: 'ad_7', name: 'RT Dynamic 1', status: 'PAUSED', campaignId: 'camp_2', adsetId: 'as_4', last: ins(0, 0, 0, 0, 0, 0), prev: ins(60, 4, 150, 2.0, 12000, 3.0) },
  { level: 'ad', id: 'ad_8', name: 'RT Dynamic 2', status: 'PAUSED', campaignId: 'camp_2', adsetId: 'as_4', last: ins(0, 0, 0, 0, 0, 0), prev: ins(60, 4, 150, 2.0, 12000, 3.0) },
  // (3) FATIGUE: active, converting fine, but frequency 5.4.
  { level: 'ad', id: 'ad_9', name: 'UGC Testimonial v3', status: 'ACTIVE', campaignId: 'camp_2', adsetId: 'as_5', last: ins(45, 3, 200, 2.4, 60000, 5.4), prev: ins(42, 3, 189, 2.4, 40000, 4.5) },
  { level: 'ad', id: 'ad_10', name: 'RT7 Static', status: 'ACTIVE', campaignId: 'camp_2', adsetId: 'as_5', last: ins(55, 3, 300, 2.2, 12000, 3.4), prev: ins(53, 3, 276, 2.2, 11000, 3.3) },
  { level: 'ad', id: 'ad_11', name: 'Cart Static A', status: 'ACTIVE', campaignId: 'camp_2', adsetId: 'as_6', last: ins(40, 2, 190, 2.6, 8000, 3.0), prev: ins(38, 2, 175, 2.6, 7500, 2.9) },
  { level: 'ad', id: 'ad_12', name: 'Cart Static B', status: 'ACTIVE', campaignId: 'camp_2', adsetId: 'as_6', last: ins(40, 2, 190, 2.4, 7000, 3.1), prev: ins(40, 2, 185, 2.4, 7000, 3.0) },
  { level: 'ad', id: 'ad_13', name: 'Test A Hook 1', status: 'ACTIVE', campaignId: 'camp_3', adsetId: 'as_7', last: ins(30, 1, 100, 1.2, 9000, 1.8), prev: ins(28, 1, 90, 1.2, 8500, 1.7) },
  { level: 'ad', id: 'ad_14', name: 'Test A Hook 2', status: 'ACTIVE', campaignId: 'camp_3', adsetId: 'as_7', last: ins(30, 1, 100, 1.1, 9000, 1.7), prev: ins(27, 1, 86, 1.1, 8500, 1.6) },
  { level: 'ad', id: 'ad_15', name: 'Test B Hook 1', status: 'ACTIVE', campaignId: 'camp_3', adsetId: 'as_8', last: ins(60, 2, 210, 1.3, 17000, 1.9), prev: ins(58, 2, 200, 1.3, 16000, 1.8) },
]

export const FIXTURE_ENTITIES: MetaAdEntity[] = seeds.map(build)

// Matches the shape the recommendations route passes to the rule engine.
export const FIXTURE_CONTEXT = {
  targetRoas: 3,
  targetCpa: 35,
  currency: '£',
}
