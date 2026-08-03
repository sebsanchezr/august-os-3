// One Sonnet call that does design direction + homepage copy + the sales call
// brief together, so the whole "request a website" build only spends one
// non-Haiku call. Never throws: on any failure the caller falls back to
// template defaults driven off the raw form fields.

import Anthropic from '@anthropic-ai/sdk'
import type { BusinessResearch } from './research'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const SONNET = 'claude-sonnet-5'
const STYLE_RULES = 'Never use em-dashes or en-dashes, use commas or full stops instead. No hype words (best, number one, unbeatable). British spelling. No exclamation-mark spam.'

export type SiteDesign = {
  niche_category: 'trades' | 'hospitality' | 'professional' | 'beauty_wellness' | 'retail' | 'generic'
  palette: { primary: string; secondary: string; accent: string; dark: string; light: string }
  image_query: string
  hero_headline: string
  hero_subhead: string
  about: string
  services: { name: string; description: string }[]
  trust_points: string[]
  cta_text: string
  sales_brief: {
    summary: string
    talking_points: string[]
    objection_prep: string[]
  }
}

function extractText(msg: Anthropic.Message): string {
  const block = msg.content.find(b => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

function fallbackDesign(businessName: string, niche: string, services: string[]): SiteDesign {
  return {
    niche_category: 'generic',
    palette: { primary: '#1a3d5c', secondary: '#c8102e', accent: '#f5b400', dark: '#0f1420', light: '#f7f8fb' },
    image_query: niche || 'business',
    hero_headline: `Trusted ${niche || 'local'} experts`,
    hero_subhead: `${businessName} delivers reliable, local service you can count on.`,
    about: `${businessName} is a local, trusted name in ${niche || 'the trade'}, known for quality work and straightforward service.`,
    services: (services.length ? services : ['General enquiries']).map(s => ({ name: s, description: `Professional ${s.toLowerCase()} done right, every time.` })),
    trust_points: ['Fully insured', 'Local and trusted', 'Fast response'],
    cta_text: 'Get a Free Quote',
    sales_brief: {
      summary: `${businessName} is a ${niche || 'local'} business. Limited public info found, lean on the discovery questions.`,
      talking_points: ['Ask how long they have been trading', 'Ask what is bringing in most leads today', 'Ask what their current site (if any) is missing'],
      objection_prep: ['If "already have a website": ask when it was last updated and how many leads it brings in', 'If "too expensive": anchor on cost of one missed job vs the investment'],
    },
  }
}

export async function generateSiteDesign(input: {
  businessName: string
  niche: string
  city: string | null
  serviceArea: string | null
  services: string[]
  ownerName: string | null
  notes: string | null
  research: BusinessResearch
}): Promise<SiteDesign> {
  const fallback = fallbackDesign(input.businessName, input.niche, input.services)
  if (!process.env.ANTHROPIC_API_KEY) return fallback

  const researchBlock = input.research.notable_facts.length || input.research.founded_year || input.research.location_detail
    ? `Research found on their existing site/listing:\n- Founded: ${input.research.founded_year || 'unknown'}\n- Years active: ${input.research.years_active || 'unknown'}\n- Location detail: ${input.research.location_detail || 'unknown'}\n- Notable facts: ${input.research.notable_facts.join('; ') || 'none'}`
    : 'No usable research found from their existing site/listing, work from the business details only.'

  const prompt = `You are building a demo website AND a sales call brief for a cold outreach agency pitching a local business a new website. ${STYLE_RULES}

BUSINESS DETAILS
Name: ${input.businessName}
Niche/trade: ${input.niche}
City: ${input.city || 'unknown'}
Service area: ${input.serviceArea || 'unknown'}
Services offered: ${input.services.join(', ') || 'unknown, infer 3 to 5 typical services for this niche'}
Owner name: ${input.ownerName || 'unknown'}
Caller notes: ${input.notes || 'none'}

${researchBlock}

TASK 1: Pick a niche_category that best fits the visual style this business needs, one of exactly: "trades" (roofing, plumbing, electrical, landscaping, building), "hospitality" (restaurant, cafe, bar, hotel), "professional" (law, accounting, consulting, financial), "beauty_wellness" (salon, spa, gym, clinic), "retail" (shop, ecommerce-adjacent local store), "generic" (anything else).

TASK 2: Pick a palette of 5 hex colours (primary, secondary, accent, dark, light) that fits the niche_category and feels premium and modern, not generic corporate blue unless the niche calls for it.

TASK 3: Write homepage copy: hero_headline (4 to 8 words, benefit or trust led), hero_subhead (one sentence, max 18 words, names the trade and town), about (2 to 3 sentences), services (one object per service in the list above, or invent 3 to 5 typical ones if none given, each with a name and a max 16 word benefit-led description), trust_points (3 short trust badges e.g. "15 years experience", "Fully insured", use research facts if available instead of generic ones), cta_text (2 to 4 words for the main button), image_query (2 to 3 words for a stock photo search that fits the niche and service, e.g. "roof repair worker").

TASK 4: Write a sales_brief for the closer about to call this business: summary (2 sentences: who they are and the strongest angle for why they need a better web presence), talking_points (3 short bullet points specific to this business using the research facts if found), objection_prep (2 short "if they say X, respond Y" bullets anticipating this niche's common objections).

Return ONLY valid JSON, no markdown fences, in exactly this shape:
{"niche_category": "...", "palette": {"primary": "#...", "secondary": "#...", "accent": "#...", "dark": "#...", "light": "#..."}, "image_query": "...", "hero_headline": "...", "hero_subhead": "...", "about": "...", "services": [{"name": "...", "description": "..."}], "trust_points": ["...", "...", "..."], "cta_text": "...", "sales_brief": {"summary": "...", "talking_points": ["...", "...", "..."], "objection_prep": ["...", "..."]}}`

  try {
    const msg = await client.messages.create({
      model: SONNET,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = extractText(msg).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(raw)
    if (!parsed.hero_headline || !parsed.palette) return fallback
    return {
      niche_category: parsed.niche_category || 'generic',
      palette: { ...fallback.palette, ...parsed.palette },
      image_query: parsed.image_query || fallback.image_query,
      hero_headline: parsed.hero_headline,
      hero_subhead: parsed.hero_subhead || fallback.hero_subhead,
      about: parsed.about || fallback.about,
      services: Array.isArray(parsed.services) && parsed.services.length ? parsed.services : fallback.services,
      trust_points: Array.isArray(parsed.trust_points) && parsed.trust_points.length ? parsed.trust_points.slice(0, 4) : fallback.trust_points,
      cta_text: parsed.cta_text || fallback.cta_text,
      sales_brief: {
        summary: parsed.sales_brief?.summary || fallback.sales_brief.summary,
        talking_points: Array.isArray(parsed.sales_brief?.talking_points) ? parsed.sales_brief.talking_points.slice(0, 4) : fallback.sales_brief.talking_points,
        objection_prep: Array.isArray(parsed.sales_brief?.objection_prep) ? parsed.sales_brief.objection_prep.slice(0, 3) : fallback.sales_brief.objection_prep,
      },
    }
  } catch {
    return fallback
  }
}
