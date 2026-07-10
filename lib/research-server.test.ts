// Standalone test for the research-grounding summarizer + context composer.
// No test runner is installed in this repo (see app/api/ads/_hygiene/rules.test.ts),
// so this compiles as plain TS and runs with node against the emitted JS:
//
//   npx tsc lib/research-server.ts lib/research-server.test.ts \
//     --outDir .tmp/rt --module commonjs --target es2020 \
//     --moduleResolution node --skipLibCheck --esModuleInterop
//   node .tmp/rt/lib/research-server.test.js
//
// It exercises summarizeTrendTrackAds + composeResearchContext against the real
// cached TrendTrack response in lib/__fixtures__/trendtrack_ads.sample.json.
// NO live TrendTrack API call is made (paid credits).

import { readFileSync } from 'fs'
import { join } from 'path'
import {
  summarizeTrendTrackAds,
  composeResearchContext,
  shopifyEnvKey,
  type TrendTrackAd,
  type ShopifySummary,
} from './research-server'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  PASS  ${msg}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${msg}`)
  }
}

// The cached file is the saved scrape shape: { terms, ads: { term: [ad,...] } }.
// The live path collects the flat json.data rows, so flatten it the same way.
type Fixture = { terms: string[]; ads: Record<string, TrendTrackAd[]> }
const fixturePath = join(process.cwd(), 'lib/__fixtures__/trendtrack_ads.sample.json')
const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Fixture
const ads: TrendTrackAd[] = Object.values(fixture.ads).flat()

console.log(`\nLoaded ${ads.length} ads across ${fixture.terms.length} terms from fixture.\n`)

// ── summarizeTrendTrackAds ────────────────────────────────────────────────────
const summary = summarizeTrendTrackAds(ads)
console.log('Summary:', JSON.stringify(summary, null, 2), '\n')

assert(summary.adCount === ads.length, `adCount matches input (${summary.adCount})`)
assert(summary.topHooks.length > 0 && summary.topHooks.length <= 6, `1..6 hooks extracted (${summary.topHooks.length})`)
assert(summary.topHooks.every(h => h.length <= 90), 'every hook is capped at 90 chars')
assert(new Set(summary.topHooks.map(h => h.toLowerCase())).size === summary.topHooks.length, 'hooks are de-duplicated')
assert(summary.formats.some(f => /^(image|video) x\d+$/.test(f)), 'formats are "type xN" counts')
assert(summary.advertisers.length > 0, `advertiser names captured (${summary.advertisers.length})`)
assert(summary.signals.some(s => /longest running \d+ days/.test(s)), 'signals report ad longevity')

// Empty input is a safe no-signal summary (never throws).
const empty = summarizeTrendTrackAds([])
assert(empty.adCount === 0 && empty.topHooks.length === 0, 'empty input yields empty summary')

// ── composeResearchContext ────────────────────────────────────────────────────
const shop: ShopifySummary = {
  productCount: 2,
  products: [
    { title: 'Marina Tote', price: '129.00', productType: 'Bags', imageUrl: 'https://x/marina.jpg' },
    { title: 'Raffia Seashell', price: '89.00', productType: 'Bags', imageUrl: null },
  ],
}

const both = composeResearchContext(summary, shop)
assert(both !== null, 'context is non-null when both sources present')
assert(!!both && both.includes('WINNING AD INTELLIGENCE (TrendTrack'), 'context has a labelled TrendTrack section')
assert(!!both && both.includes('STORE BEST SELLERS (Shopify'), 'context has a labelled Shopify section')
assert(!!both && both.includes('Marina Tote') && both.includes('129.00'), 'real product name + price appear in context')
assert(!!both && both.length <= 1200, `context is capped near 1200 chars (${both?.length})`)

assert(composeResearchContext(null, null) === null, 'null + null -> null (no-op grounding)')
assert(composeResearchContext(summary, null) !== null, 'TrendTrack-only still produces context')
assert(composeResearchContext(null, shop) !== null, 'Shopify-only still produces context')
assert(composeResearchContext(summarizeTrendTrackAds([]), null) === null, 'empty TrendTrack + null Shopify -> null')

// ── shopifyEnvKey convention ──────────────────────────────────────────────────
assert(shopifyEnvKey('Lillys Amsterdam') === 'LILLYS', 'Lillys Amsterdam -> LILLYS')
assert(shopifyEnvKey("L'alingi") === 'LALINGI', "L'alingi -> LALINGI")
assert(shopifyEnvKey('') === '', 'empty name -> empty key')

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}\n`)
if (failures > 0) process.exit(1)
