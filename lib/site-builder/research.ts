// Research pass for the "request a website" pipeline. Two real data sources,
// tried in order, never fatal:
//   1. Apify's Google Places scraper (real phone, address, photos, rating,
//      reviews) off the caller's Google Maps URL, or a name+city search when
//      there's no URL. This is the one that actually has data — a plain
//      fetch() on a Maps URL returns a JS shell with zero business info.
//   2. If the caller instead gave an existing website URL, scrape that page's
//      text with Haiku for whatever extra facts Google didn't have (founded
//      year, notable facts). Runs regardless of whether Apify succeeded.
// A regex parse of the Maps URL itself is the zero-cost last resort for
// address/postcode when Apify is unavailable or fails.

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const HAIKU = 'claude-haiku-4-5-20251001'
const APIFY_MAPS_ACTOR = 'compass~crawler-google-places'

export type BusinessResearch = {
  confirmed_name: string | null
  phone: string | null
  address: string | null
  city: string | null
  postcode: string | null
  rating: number | null
  review_count: number | null
  review_texts: string[]
  categories: string[]
  has_opening_hours: boolean
  photos: string[]
  logo_url: string | null
  founded_year: string | null
  years_active: string | null
  notable_facts: string[]
}

const EMPTY: BusinessResearch = {
  confirmed_name: null,
  phone: null,
  address: null,
  city: null,
  postcode: null,
  rating: null,
  review_count: null,
  review_texts: [],
  categories: [],
  has_opening_hours: false,
  photos: [],
  logo_url: null,
  founded_year: null,
  years_active: null,
  notable_facts: [],
}

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i

function extractText(msg: Anthropic.Message): string {
  const block = msg.content.find(b => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

// Zero-cost fallback: the address is often sitting in the Maps URL itself,
// e.g. .../place/Peak+roofer+ltd,+Hepworth+Gardens,+Barking+IG11+9AX/@51...
function parseMapsUrl(url: string): { address: string | null; city: string | null; postcode: string | null } {
  const match = url.match(/\/place\/([^/@]+)/)
  if (!match) return { address: null, city: null, postcode: null }
  const decoded = decodeURIComponent(match[1].replace(/\+/g, ' '))
  const parts = decoded.split(',').map(s => s.trim()).filter(Boolean)
  const postcodeMatch = decoded.match(UK_POSTCODE_RE)
  const postcode = postcodeMatch ? `${postcodeMatch[1]} ${postcodeMatch[2]}`.toUpperCase() : null
  // The part right before the postcode segment is usually the town.
  const cityPart = parts.length > 1 ? parts[parts.length - 1].replace(UK_POSTCODE_RE, '').trim() : null
  return {
    address: parts.slice(1).join(', ') || null,
    city: cityPart || null,
    postcode,
  }
}

function isMapsUrl(url: string): boolean {
  return /google\.[a-z.]+\/maps/i.test(url) || /goo\.gl\/maps/i.test(url)
}

// lh3.googleusercontent.com URLs end in a size directive like
// "...=w1920-h1080-k-no"; swap it rather than trust whatever Apify returned.
function resizePhoto(url: string, size: string): string {
  if (!url.includes('lh3.googleusercontent.com')) return url
  return url.includes('=w') ? url.replace(/=w\d+-h\d+[^&]*$/, size) : `${url}${size}`
}

async function runApifyPlaces(input: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const token = process.env.APIFY_TOKEN
  if (!token) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 100_000)
    const res = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_MAPS_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=180`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
    clearTimeout(timeout)
    if (!res.ok) return null
    const items = await res.json()
    return Array.isArray(items) && items.length ? items[0] : null
  } catch {
    return null
  }
}

async function researchFromGoogle(businessName: string, city: string | null, googleUrl: string | null): Promise<Partial<BusinessResearch>> {
  const urlFallback = googleUrl && isMapsUrl(googleUrl) ? parseMapsUrl(googleUrl) : { address: null, city: null, postcode: null }

  const input: Record<string, unknown> = {
    maxCrawledPlacesPerSearch: 1,
    language: 'en',
    countryCode: 'gb',
    maxReviews: 10,
    maxImages: 30,
  }
  if (googleUrl && isMapsUrl(googleUrl)) {
    input.startUrls = [{ url: googleUrl }]
  } else {
    input.searchStringsArray = [`${businessName} ${city || ''}`.trim()]
  }

  const place = await runApifyPlaces(input)
  if (!place) {
    return { address: urlFallback.address, city: urlFallback.city, postcode: urlFallback.postcode }
  }

  const rawPhotos: string[] = (place.imageUrls as string[] | undefined)
    || ((place.images as { url?: string }[] | undefined)?.map(i => i.url).filter(Boolean) as string[] | undefined)
    || []
  const photos = rawPhotos
    .filter(u => typeof u === 'string' && u.includes('lh3.googleusercontent.com'))
    .slice(0, 8)
    .map(u => resizePhoto(u, '=w1200-h900-k-no'))

  const rawReviews = (place.reviews as { text?: string; stars?: number }[] | undefined) || []
  const review_texts = rawReviews.map(r => r.text).filter((t): t is string => !!t && t.length > 10).slice(0, 5)

  return {
    confirmed_name: (place.title as string) || null,
    phone: (place.phone as string) || null,
    address: (place.address as string) || urlFallback.address,
    city: (place.city as string) || urlFallback.city,
    postcode: (place.postalCode as string) || urlFallback.postcode,
    rating: typeof place.totalScore === 'number' ? place.totalScore : null,
    review_count: typeof place.reviewsCount === 'number' ? place.reviewsCount : null,
    review_texts,
    categories: (place.categories as string[] | undefined) || [],
    has_opening_hours: !!place.openingHours,
    photos,
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractLogoUrl(html: string, baseUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["'](?:apple-touch-icon|icon)["'][^>]+href=["']([^"']+)["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) {
      try {
        return new URL(m[1], baseUrl).toString()
      } catch {
        continue
      }
    }
  }
  return null
}

async function fetchPage(url: string): Promise<{ text: string; html: string } | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AugustOSBot/1.0)' },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const html = await res.text()
    return { text: stripHtml(html).slice(0, 6000), html }
  } catch {
    return null
  }
}

async function researchFromExistingSite(businessName: string, siteUrl: string): Promise<Partial<BusinessResearch>> {
  const page = await fetchPage(siteUrl)
  if (!page || !page.text) return {}

  const logo_url = extractLogoUrl(page.html, siteUrl)
  if (!process.env.ANTHROPIC_API_KEY) return { logo_url }

  const prompt = `Read this scraped page text for the business "${businessName}" and extract what a salesperson needs to know before calling them. Return ONLY valid JSON, no markdown fences, in this exact shape:
{"founded_year": "e.g. 2011 or null", "years_active": "e.g. 13 years or null", "notable_facts": ["up to 3 short factual bullet points a caller could reference, e.g. awards, specialisms, family-run, number of reviews"]}

If the page has nothing useful, return {"founded_year": null, "years_active": null, "notable_facts": []}. Never invent facts not present in the text.

PAGE TEXT:
${page.text}`

  try {
    const msg = await client.messages.create({
      model: HAIKU,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = extractText(msg).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(raw)
    return {
      founded_year: parsed.founded_year || null,
      years_active: parsed.years_active || null,
      notable_facts: Array.isArray(parsed.notable_facts) ? parsed.notable_facts.slice(0, 3).map(String) : [],
      logo_url,
    }
  } catch {
    return { logo_url }
  }
}

export async function researchBusiness(
  businessName: string,
  city: string | null,
  googleUrl: string | null,
  existingSiteUrl: string | null,
): Promise<BusinessResearch> {
  const [googleResult, siteResult] = await Promise.all([
    researchFromGoogle(businessName, city, googleUrl),
    existingSiteUrl ? researchFromExistingSite(businessName, existingSiteUrl) : Promise.resolve<Partial<BusinessResearch>>({}),
  ])

  return {
    ...EMPTY,
    ...googleResult,
    ...siteResult,
    // Google Places photos beat a generic site scrape; keep the logo from
    // whichever source found one.
    logo_url: siteResult.logo_url || googleResult.logo_url || null,
  }
}
