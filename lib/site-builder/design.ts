// One Sonnet call for the creative copy + design direction of the demo site,
// plus the sales call brief. Deliberately does NOT generate anything a
// prospect could catch as fabricated on the call: ratings, review counts,
// accreditation body names, testimonials and the founder block are all
// assembled deterministically in index.ts from real research/form data, never
// from the model. This function only ever writes marketing copy.

import Anthropic from '@anthropic-ai/sdk'
import type { BusinessResearch } from './research'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const SONNET = 'claude-sonnet-5'
const STYLE_RULES = 'Never use em-dashes or en-dashes, use commas or full stops instead. No hype words (best, number one, unbeatable). British spelling. No exclamation-mark spam.'

export type SiteDesign = {
  niche_category: 'trades' | 'hospitality' | 'professional' | 'beauty_wellness' | 'retail' | 'generic'
  palette: { primary: string; accent: string; ink: string; surface: string; surface_alt: string }
  emergency_strip: { enabled: boolean; text: string }
  hero_headline: string
  hero_subhead: string
  about: string
  why_choose: { title: string; description: string }[]
  services: { name: string; description: string }[]
  process: { step: number; title: string; description: string }[]
  faqs: { q: string; a: string }[]
  trust_badges: string[]
  service_areas: string[]
  cta_text: string
  image_query: string
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

function fallbackDesign(businessName: string, niche: string, services: string[], city: string | null): SiteDesign {
  const svc = services.length ? services : ['General enquiries']
  return {
    niche_category: 'generic',
    palette: { primary: '#1a3d5c', accent: '#c8102e', ink: '#14212e', surface: '#ffffff', surface_alt: '#f4f6f8' },
    emergency_strip: { enabled: false, text: '' },
    hero_headline: `Trusted ${niche || 'local'} experts`,
    hero_subhead: `${businessName} delivers reliable, local service you can count on.`,
    about: `${businessName} is a local, trusted name in ${niche || 'the trade'}, known for quality work and straightforward service.`,
    why_choose: [
      { title: 'Local and reliable', description: 'Based in the area and easy to reach when you need us.' },
      { title: 'Straightforward pricing', description: 'Clear quotes with no hidden extras.' },
      { title: 'Fast response', description: 'We get back to enquiries quickly.' },
    ],
    services: svc.map(s => ({ name: s, description: `Professional ${s.toLowerCase()} done right, every time.` })),
    process: [
      { step: 1, title: 'Get in touch', description: 'Call or send your details and tell us what you need.' },
      { step: 2, title: 'Free quote', description: 'We give you a clear, no-obligation quote.' },
      { step: 3, title: 'We get to work', description: 'Work carried out to a high standard, on schedule.' },
      { step: 4, title: 'Job done', description: 'Tidy finish and a result you are happy with.' },
    ],
    faqs: [
      { q: 'What areas do you cover?', a: `${businessName} covers ${city || 'the local area'} and nearby.` },
      { q: 'Do you offer free quotes?', a: 'Yes, get in touch for a free, no-obligation quote.' },
    ],
    trust_badges: ['Local team', 'Free quotes', 'Fast response'],
    service_areas: city ? [city] : [],
    cta_text: 'Get a Free Quote',
    image_query: niche || 'business',
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
  amend?: { notes: string; previousDesign: SiteDesign }
}): Promise<SiteDesign> {
  // Backfill defaults first, then layer the previous version on top — an
  // amend on a pre-v2 build has an old, narrower site_design shape (no
  // why_choose/process/faqs/trust_badges/etc), so using it as the fallback
  // directly would leave those keys undefined instead of falling back.
  const fallback = input.amend
    ? { ...fallbackDesign(input.businessName, input.niche, input.services, input.city), ...input.amend.previousDesign }
    : fallbackDesign(input.businessName, input.niche, input.services, input.city)
  if (!process.env.ANTHROPIC_API_KEY) return fallback

  const r = input.research
  const researchBlock = [
    r.confirmed_name ? `Confirmed business name on Google: ${r.confirmed_name}` : null,
    r.address ? `Address: ${r.address}` : null,
    r.city ? `City/town: ${r.city}` : null,
    r.categories.length ? `Google category: ${r.categories.join(', ')}` : null,
    r.founded_year ? `Founded: ${r.founded_year}` : null,
    r.years_active ? `Years active: ${r.years_active}` : null,
    r.notable_facts.length ? `Notable facts found: ${r.notable_facts.join('; ')}` : null,
    r.rating != null ? `Google rating: ${r.rating} (${r.review_count ?? 0} reviews) — DO NOT restate this number yourself, it is rendered separately from real data` : 'No Google rating found, this business may be new or unrated',
  ].filter(Boolean).join('\n') || 'No usable research found, work from the business details only.'

  const amendBlock = input.amend
    ? `\nTHIS IS A REVISION of a version already generated. The previous version, in the exact same JSON shape, was:\n\`\`\`json\n${JSON.stringify(input.amend.previousDesign, null, 2)}\n\`\`\`\nThe caller reviewing it requested these changes:\n"${input.amend.notes}"\n\nApply ONLY the requested changes. Keep everything else (wording, palette, structure) the same as the previous version unless the request implies it should change too.\n`
    : ''

  const prompt = `You are writing the copy for a demo website AND a sales call brief, for a cold outreach agency pitching a local business a new website. ${STYLE_RULES}
${amendBlock}
BUSINESS DETAILS
Name: ${input.businessName}
Niche/trade: ${input.niche}
City: ${input.city || 'unknown'}
Service area: ${input.serviceArea || 'unknown'}
Services offered: ${input.services.join(', ') || 'unknown, infer 3 to 5 typical services for this niche'}
Owner name: ${input.ownerName || 'unknown'}
Caller notes: ${input.notes || 'none'}

RESEARCH (only source of truth for facts, do not invent anything beyond this)
${researchBlock}

CRITICAL RULE: Never invent a star rating, a review count, a specific testimonial quote, a named accreditation body (NFRC, TrustMark, Which? Trusted Trader, Checkatrade, Gas Safe etc), or a specific guarantee period (e.g. "25 year guarantee"). Those are rendered separately from verified data only. If you don't have real facts for something, write generically (e.g. "Free, no-obligation quotes" not "Rated 4.9 on Google").

This is a light-theme website (UK trades/local business convention, never dark). Pick a "trades" (roofing, plumbing, electrical, building, landscaping), "hospitality" (restaurant, cafe, bar), "professional" (law, accounting, consulting), "beauty_wellness" (salon, spa, gym), "retail", or "generic" niche_category, and write:

1. palette: primary (dark navy/brand colour for header/text accents), accent (high-contrast CTA colour, warm and premium, not generic blue unless it fits), ink (near-black body text colour), surface (white or near-white background), surface_alt (a very light tint for alternating sections). All hex.
2. emergency_strip: enabled=true only for niches with genuine emergencies (roofing, plumbing, electrical, locksmith, pest control), with a short urgent text line, else enabled=false.
3. hero_headline (4 to 8 words, benefit or trust led) and hero_subhead (one sentence, max 20 words, names the trade and town, can reference founded/years_active if present in research).
4. about (2 to 3 sentences, weave in any real research facts).
5. why_choose: 4 short benefit tiles (title 2-4 words, description max 14 words), grounded in what a customer actually cares about for this niche.
6. services: one object per service listed above (or invent 3 to 5 typical ones if none given), each with a name and a max 16 word benefit-led description.
7. process: exactly 4 steps a customer goes through from enquiry to job done, step-numbered.
8. faqs: 5 short, realistic customer questions with concise answers.
9. trust_badges: 3 to 4 short generic trust phrases (e.g. "Local & reliable", "Free, no-obligation quotes", "Fast response times"). No certifications, no numbers you cannot back up.
10. service_areas: 8 to 15 real place names plausibly near "${input.city || input.serviceArea || 'the business'}" in the UK (nearby towns/districts), for a "areas we cover" section.
11. cta_text (2 to 4 words for the main button).
12. image_query (2 to 3 words for a stock photo search fallback, only used if no real photos exist).
13. sales_brief: summary (2 sentences on who they are and the strongest angle for why they need a better web presence), talking_points (3 bullets specific to this business using research facts if found), objection_prep (2 "if they say X, respond Y" bullets for this niche's common objections).

Return ONLY valid JSON, no markdown fences, in exactly this shape:
{"niche_category": "...", "palette": {"primary": "#...", "accent": "#...", "ink": "#...", "surface": "#...", "surface_alt": "#..."}, "emergency_strip": {"enabled": true, "text": "..."}, "hero_headline": "...", "hero_subhead": "...", "about": "...", "why_choose": [{"title": "...", "description": "..."}], "services": [{"name": "...", "description": "..."}], "process": [{"step": 1, "title": "...", "description": "..."}], "faqs": [{"q": "...", "a": "..."}], "trust_badges": ["...", "..."], "service_areas": ["...", "..."], "cta_text": "...", "image_query": "...", "sales_brief": {"summary": "...", "talking_points": ["...", "...", "..."], "objection_prep": ["...", "..."]}}`

  try {
    const msg = await client.messages.create({
      model: SONNET,
      max_tokens: 5000,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = extractText(msg).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(raw)
    if (!parsed.hero_headline || !parsed.palette) {
      console.error('[design.ts] response missing hero_headline/palette, stop_reason:', msg.stop_reason, 'keys:', Object.keys(parsed))
      return fallback
    }
    return {
      niche_category: parsed.niche_category || 'generic',
      palette: { ...fallback.palette, ...parsed.palette },
      emergency_strip: parsed.emergency_strip?.text ? parsed.emergency_strip : { enabled: false, text: '' },
      hero_headline: parsed.hero_headline,
      hero_subhead: parsed.hero_subhead || fallback.hero_subhead,
      about: parsed.about || fallback.about,
      why_choose: Array.isArray(parsed.why_choose) && parsed.why_choose.length ? parsed.why_choose.slice(0, 6) : fallback.why_choose,
      services: Array.isArray(parsed.services) && parsed.services.length ? parsed.services : fallback.services,
      process: Array.isArray(parsed.process) && parsed.process.length ? parsed.process.slice(0, 4) : fallback.process,
      faqs: Array.isArray(parsed.faqs) && parsed.faqs.length ? parsed.faqs.slice(0, 6) : fallback.faqs,
      trust_badges: Array.isArray(parsed.trust_badges) && parsed.trust_badges.length ? parsed.trust_badges.slice(0, 4) : fallback.trust_badges,
      service_areas: Array.isArray(parsed.service_areas) && parsed.service_areas.length ? parsed.service_areas.slice(0, 15) : fallback.service_areas,
      cta_text: parsed.cta_text || fallback.cta_text,
      image_query: parsed.image_query || fallback.image_query,
      sales_brief: {
        summary: parsed.sales_brief?.summary || fallback.sales_brief.summary,
        talking_points: Array.isArray(parsed.sales_brief?.talking_points) ? parsed.sales_brief.talking_points.slice(0, 4) : fallback.sales_brief.talking_points,
        objection_prep: Array.isArray(parsed.sales_brief?.objection_prep) ? parsed.sales_brief.objection_prep.slice(0, 3) : fallback.sales_brief.objection_prep,
      },
    }
  } catch (err) {
    console.error('[design.ts] generateSiteDesign failed:', err)
    return fallback
  }
}
