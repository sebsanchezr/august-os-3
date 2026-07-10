// Server-only: research grounding for the Creative Hub.
//
// Enriches generated ad concepts with two external signals:
//   1. TrendTrack winning-ad intelligence (Meta/TikTok ads with proven
//      longevity + reach) for the client's tracked niches/brands.
//   2. The client's own Shopify store best sellers (real product names/prices).
//
// Both sources are ENV-GATED and fully optional: if the keys or per-client
// config are missing, the fetchers return null and concept generation is
// unchanged. Results are cached in-memory for 24h keyed by client id so
// repeated generations never re-burn TrendTrack credits.
//
// fetch only (no new SDK deps). Imported by API routes only; never from a
// client component.
//
// TrendTrack request patterns mirror execution/scrape_trendtrack.py in the
// AM Agency workspace:
//   - Base URL https://api.trendtrack.io, Authorization: Bearer <key>
//   - GET /v1/ads?search=<term>&limit=<n>&sortBy=<enum>
//   - CREDIT MODEL: /v1/ads charges 1 credit PER RETURNED ROW. Keep limits
//     tiny and always serve from cache when possible.
//   - SORT GOTCHA: sortBy MUST be one of relevance | newest | longestRunning |
//     reach. "daysRunning" is INVALID and 400s. We use longestRunning to
//     surface proven winners.

// ─── Shared client shape ──────────────────────────────────────────────────────
// Minimal projection of a clients row needed for research. trendtrak_ids are the
// per-client tracked search terms / niches (clients.trendtrak_ids text[]).
export type ResearchClient = {
  id: string
  name: string
  trendtrak_ids?: string[] | null
}

// ─── TrendTrack ───────────────────────────────────────────────────────────────

const TRENDTRACK_BASE = 'https://api.trendtrack.io'

// The raw ad shape we read from the TrendTrack /v1/ads response (a subset; see
// scrape_trendtrack.py flatten_ad for the full field list).
export type TrendTrackAd = {
  id?: string
  platform?: string
  status?: string
  daysRunning?: number | null
  media?: { type?: string | null; mediaUrl?: string | null } | null
  advertiser?: { name?: string | null; reach30d?: number | null; totalReach?: number | null } | null
  content?: { title?: string | null; body?: string | null; callToAction?: string | null } | null
  metrics?: { reach?: number | null; estimatedSpend?: number | null } | null
}

export type TrendTrackSummary = {
  adCount: number
  topHooks: string[] // punchy hook lines lifted from winning ads
  formats: string[] // e.g. ["image x8", "video x2"]
  advertisers: string[] // distinct advertiser names, winners first
  ctas: string[] // distinct call-to-action labels
  signals: string[] // engagement signals (longevity, reach)
}

// Lift a short hook line from an ad: prefer the headline/title, else the first
// non-empty sentence of the body. Collapsed whitespace, capped for prompt use.
function hookFromAd(ad: TrendTrackAd): string {
  const title = (ad.content?.title ?? '').trim()
  const body = (ad.content?.body ?? '').trim()
  const raw = title || body.split(/(?<=[.!?\n])\s+/)[0] || ''
  return raw.replace(/\s+/g, ' ').trim().slice(0, 90)
}

function fmtReach(n: number | null | undefined): string {
  if (!n || n <= 0) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

// Turn a batch of raw TrendTrack ads into a compact, prompt-ready summary.
// Pure + exported so it can be unit-tested against cached fixture JSON with no
// live API call.
export function summarizeTrendTrackAds(ads: TrendTrackAd[], maxHooks = 6): TrendTrackSummary {
  const clean = (ads ?? []).filter(Boolean)

  // Hooks: dedupe, drop empties, keep the most (proven winners come first if the
  // caller already sorted by longevity/reach).
  const seenHook = new Set<string>()
  const topHooks: string[] = []
  for (const ad of clean) {
    const h = hookFromAd(ad)
    const key = h.toLowerCase()
    if (h && !seenHook.has(key)) {
      seenHook.add(key)
      topHooks.push(h)
      if (topHooks.length >= maxHooks) break
    }
  }

  // Formats: count by media type.
  const formatCounts = new Map<string, number>()
  for (const ad of clean) {
    const t = (ad.media?.type ?? 'unknown').toLowerCase()
    formatCounts.set(t, (formatCounts.get(t) ?? 0) + 1)
  }
  const formats = [...formatCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t} x${n}`)

  // Advertisers: distinct names, in first-seen order (winners first).
  const seenAdv = new Set<string>()
  const advertisers: string[] = []
  for (const ad of clean) {
    const name = (ad.advertiser?.name ?? '').trim()
    if (name && !seenAdv.has(name.toLowerCase())) {
      seenAdv.add(name.toLowerCase())
      advertisers.push(name)
    }
  }

  // CTAs: distinct call-to-action labels.
  const seenCta = new Set<string>()
  const ctas: string[] = []
  for (const ad of clean) {
    const c = (ad.content?.callToAction ?? '').trim()
    if (c && !seenCta.has(c.toLowerCase())) {
      seenCta.add(c.toLowerCase())
      ctas.push(c)
    }
  }

  // Signals: longevity + reach of the strongest performers.
  const maxDays = clean.reduce((m, a) => Math.max(m, a.daysRunning ?? 0), 0)
  const maxReach = clean.reduce(
    (m, a) => Math.max(m, a.metrics?.reach ?? a.advertiser?.reach30d ?? 0),
    0
  )
  const signals: string[] = []
  if (maxDays > 0) signals.push(`longest running ${maxDays} days`)
  if (maxReach > 0) signals.push(`top reach ${fmtReach(maxReach)}`)

  return {
    adCount: clean.length,
    topHooks,
    formats,
    advertisers: advertisers.slice(0, 8),
    ctas: ctas.slice(0, 5),
    signals,
  }
}

// ─── 24h in-memory caches ─────────────────────────────────────────────────────
// Keyed by client id. Serverless instances are short-lived, but within one warm
// instance this prevents repeated generations from re-hitting the paid API.
const DAY_MS = 24 * 60 * 60 * 1000
type CacheEntry<T> = { at: number; value: T }
const trendTrackCache = new Map<string, CacheEntry<TrendTrackSummary | null>>()
const shopifyCache = new Map<string, CacheEntry<ShopifySummary | null>>()

function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string): { hit: boolean; value: T | null } {
  const e = cache.get(key)
  if (e && Date.now() - e.at < DAY_MS) return { hit: true, value: e.value }
  return { hit: false, value: null }
}

// Exposed for tests: clear both caches.
export function _clearResearchCache(): void {
  trendTrackCache.clear()
  shopifyCache.clear()
}

// Fetch top winning ads for a client's tracked niches/brands.
// Returns null (a no-op) when TRENDTRACK_API_KEY is unset or the client has no
// tracked ids, so generation degrades gracefully. Serves from the 24h cache
// when warm to avoid burning credits.
export async function fetchTrendTrackResearch(client: ResearchClient): Promise<TrendTrackSummary | null> {
  const apiKey = process.env.TRENDTRACK_API_KEY?.trim()
  const terms = (client.trendtrak_ids ?? []).map(t => (t ?? '').trim()).filter(Boolean)
  if (!apiKey || terms.length === 0) return null

  const cached = cacheGet(trendTrackCache, client.id)
  if (cached.hit) return cached.value

  // Credit safety: cap total returned rows to ~10 across all tracked terms.
  const TOTAL_LIMIT = 10
  const perTerm = Math.max(1, Math.floor(TOTAL_LIMIT / Math.min(terms.length, 3)))
  const useTerms = terms.slice(0, 3)

  const collected: TrendTrackAd[] = []
  try {
    for (const term of useTerms) {
      const params = new URLSearchParams({
        search: term,
        limit: String(perTerm),
        // Proven winners; NEVER "daysRunning" (that 400s). See scrape_trendtrack.py.
        sortBy: 'longestRunning',
      })
      const res = await fetch(`${TRENDTRACK_BASE}/v1/ads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) {
        console.warn(`[research] TrendTrack ${term}: HTTP ${res.status}`)
        continue
      }
      const json = await res.json()
      const rows: TrendTrackAd[] = Array.isArray(json?.data) ? json.data : []
      collected.push(...rows)
    }
  } catch (err) {
    console.warn('[research] TrendTrack fetch failed:', (err as Error).message)
    // Fall through: cache the (possibly partial) result we have.
  }

  const summary = collected.length > 0 ? summarizeTrendTrackAds(collected) : null
  trendTrackCache.set(client.id, { at: Date.now(), value: summary })
  return summary
}

// ─── Shopify ──────────────────────────────────────────────────────────────────

export type ShopifyProduct = {
  title: string
  price: string | null
  productType: string | null
  imageUrl: string | null
}

export type ShopifySummary = {
  productCount: number
  products: ShopifyProduct[]
}

// Per-client env convention (documented in ENV_CHECKLIST.md):
//   SHOPIFY_ACCESS_TOKEN_<KEY> and SHOPIFY_DOMAIN_<KEY>
// where <KEY> is derived from the client's name: take the FIRST word, uppercase
// it, strip non-alphanumerics. Examples:
//   "Lillys Amsterdam" -> LILLYS  (SHOPIFY_ACCESS_TOKEN_LILLYS / SHOPIFY_DOMAIN_LILLYS)
//   "L'alingi"         -> LALINGI
// A store is only queried when BOTH vars are set for that key; otherwise the
// fetcher returns null and generation is unchanged.
export function shopifyEnvKey(name: string): string {
  const firstWord = (name ?? '').trim().split(/\s+/)[0] ?? ''
  return firstWord.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// Fetch up to 10 products (title, price, product type, image) from the client's
// Shopify store via the Admin REST API. Returns null when the store env vars are
// unset for this client. Read-only. Cached 24h by client id.
export async function fetchShopifyResearch(client: ResearchClient): Promise<ShopifySummary | null> {
  const key = shopifyEnvKey(client.name)
  if (!key) return null
  const token = process.env[`SHOPIFY_ACCESS_TOKEN_${key}`]?.trim()
  let domain = process.env[`SHOPIFY_DOMAIN_${key}`]?.trim()
  if (!token || !domain) return null

  // Normalise domain: accept "store", "store.myshopify.com", or a full URL.
  domain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (!domain.includes('.')) domain = `${domain}.myshopify.com`

  const cached = cacheGet(shopifyCache, client.id)
  if (cached.hit) return cached.value

  let summary: ShopifySummary | null = null
  try {
    const url = `https://${domain}/admin/api/2024-10/products.json?limit=10&status=active`
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token, Accept: 'application/json' },
    })
    if (!res.ok) {
      console.warn(`[research] Shopify ${key}: HTTP ${res.status}`)
    } else {
      const json = await res.json()
      const products: ShopifyProduct[] = (json?.products ?? []).map((p: Record<string, unknown>) => {
        const variants = (p.variants as Array<{ price?: string }> | undefined) ?? []
        const images = (p.images as Array<{ src?: string }> | undefined) ?? []
        const image = (p.image as { src?: string } | undefined) ?? images[0]
        return {
          title: String(p.title ?? '').trim(),
          price: variants[0]?.price ?? null,
          productType: (p.product_type ? String(p.product_type) : null) || null,
          imageUrl: image?.src ?? null,
        }
      }).filter((p: ShopifyProduct) => p.title)
      summary = { productCount: products.length, products }
    }
  } catch (err) {
    console.warn('[research] Shopify fetch failed:', (err as Error).message)
  }

  shopifyCache.set(client.id, { at: Date.now(), value: summary })
  return summary
}

// ─── Combined context ─────────────────────────────────────────────────────────

const MAX_CONTEXT_CHARS = 1200

// Build a compact, clearly-labelled research context block for prompt grounding.
// Combines TrendTrack winning-ad intelligence + Shopify best sellers. Returns
// null when neither source is available (so callers can skip it entirely).
export async function buildResearchContext(client: ResearchClient): Promise<string | null> {
  const [tt, shop] = await Promise.all([
    fetchTrendTrackResearch(client),
    fetchShopifyResearch(client),
  ])
  return composeResearchContext(tt, shop)
}

// Pure composer, split out so it can be unit-tested without any network. Caps the
// output near MAX_CONTEXT_CHARS.
export function composeResearchContext(
  tt: TrendTrackSummary | null,
  shop: ShopifySummary | null
): string | null {
  const sections: string[] = []

  if (tt && tt.adCount > 0) {
    const lines = [`WINNING AD INTELLIGENCE (TrendTrack, ${tt.adCount} proven ads):`]
    if (tt.topHooks.length) lines.push(`- Hooks that are working: ${tt.topHooks.map(h => `"${h}"`).join(' | ')}`)
    if (tt.formats.length) lines.push(`- Formats: ${tt.formats.join(', ')}`)
    if (tt.ctas.length) lines.push(`- CTAs: ${tt.ctas.join(', ')}`)
    if (tt.advertisers.length) lines.push(`- Advertisers running these: ${tt.advertisers.join(', ')}`)
    if (tt.signals.length) lines.push(`- Signals: ${tt.signals.join('; ')}`)
    sections.push(lines.join('\n'))
  }

  if (shop && shop.productCount > 0) {
    const lines = [`STORE BEST SELLERS (Shopify, ${shop.productCount} products):`]
    for (const p of shop.products.slice(0, 10)) {
      const bits = [p.title]
      if (p.productType) bits.push(`(${p.productType})`)
      if (p.price) bits.push(`- ${p.price}`)
      lines.push(`- ${bits.join(' ')}`)
    }
    sections.push(lines.join('\n'))
  }

  if (sections.length === 0) return null
  const block = sections.join('\n\n')
  return block.length > MAX_CONTEXT_CHARS ? `${block.slice(0, MAX_CONTEXT_CHARS - 3)}...` : block
}
