// One Sonnet call for the creative copy + design direction of the demo site,
// plus the sales call brief. Deliberately does NOT generate anything a
// prospect could catch as fabricated on the call: ratings, review counts,
// accreditation body names, testimonials, stats and the founder block are all
// assembled deterministically in index.ts from real research/form data, never
// from the model. This function only ever writes marketing copy.

import Anthropic from '@anthropic-ai/sdk'
import type { BusinessResearch } from './research'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const SONNET = 'claude-sonnet-5'

export type SiteDesign = {
  niche_category: 'trades' | 'hospitality' | 'professional' | 'beauty_wellness' | 'retail' | 'generic'
  palette: { primary: string; accent: string; ink: string; surface: string; surface_alt: string }
  emergency_strip: { enabled: boolean; text: string }
  eyebrow: string
  hero_headline: string
  hero_subhead: string
  hero_points: string[]
  about_heading: string
  about: string
  why_choose: { title: string; description: string }[]
  services: { name: string; description: string }[]
  process: { step: number; title: string; description: string }[]
  faqs: { q: string; a: string }[]
  trust_badges: string[]
  service_areas: string[]
  cta_headline: string
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
  const where = city || 'the local area'
  return {
    niche_category: 'generic',
    palette: { primary: '#12212e', accent: '#e0651a', ink: '#14212e', surface: '#ffffff', surface_alt: '#f5f3ef' },
    emergency_strip: { enabled: false, text: '' },
    eyebrow: `${niche || 'Local'} specialists · ${where}`,
    hero_headline: `Built properly. First time.`,
    hero_subhead: `${businessName} handles ${niche || 'the work'} across ${where}, with clear pricing and no surprises.`,
    hero_points: ['Free quotes', 'Fully insured', 'Local team'],
    about_heading: 'A local firm that turns up',
    about: `${businessName} works across ${where}. Straight answers, tidy work, and a price agreed before anything starts.`,
    why_choose: [
      { title: 'Straight pricing', description: 'A fixed quote before we start. What we say is what you pay.' },
      { title: 'On the tools daily', description: 'Local team, working in your area every week.' },
      { title: 'Tidy finish', description: 'Site cleared, waste taken away, nothing left behind.' },
      { title: 'Quick to answer', description: 'Calls picked up, quotes back fast.' },
    ],
    services: svc.map(s => ({ name: s, description: `${s} handled end to end, priced up front.` })),
    process: [
      { step: 1, title: 'Call or message', description: 'Tell us what is going on. Photos help.' },
      { step: 2, title: 'We take a look', description: 'A proper inspection, then a fixed written quote.' },
      { step: 3, title: 'The work gets done', description: 'Booked in, turned up for, finished on schedule.' },
      { step: 4, title: 'Signed off', description: 'We walk it with you before we leave.' },
    ],
    faqs: [
      { q: 'What areas do you cover?', a: `${where} and the surrounding area. Ask if you are not sure.` },
      { q: 'Do you charge for quotes?', a: 'No. Quotes are free and there is no obligation.' },
    ],
    trust_badges: ['Free quotes', 'Fully insured', 'Local team', 'Fast response'],
    service_areas: city ? [city] : [],
    cta_headline: 'Get a price this week',
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
  // amend on an older build has a narrower site_design shape, so using it as
  // the fallback directly would leave newer keys undefined.
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
    r.rating != null ? `Google rating: ${r.rating} (${r.review_count ?? 0} reviews). DO NOT restate this number in your copy, it is rendered separately from real data.` : 'No Google rating found, this business may be new or unrated.',
  ].filter(Boolean).join('\n') || 'No usable research found, work from the business details only.'

  const amendBlock = input.amend
    ? `\nTHIS IS A REVISION of a version already generated. The previous version, in the exact same JSON shape, was:\n\`\`\`json\n${JSON.stringify(input.amend.previousDesign, null, 2)}\n\`\`\`\nThe caller reviewing it requested these changes:\n"${input.amend.notes}"\n\nApply the requested changes. Keep what is working. If the request is about quality or feel generally ("make it better", "more premium"), rewrite the copy properly rather than making token edits.\n`
    : ''

  const prompt = `You are a senior conversion copywriter for a high-end design studio. You are writing the copy for a website that will be shown live to this business owner on a sales call, to convince them to pay two thousand pounds for it. The copy is the difference between "that's nice" and "how do I pay".
${amendBlock}
BUSINESS
Name: ${input.businessName}
Trade: ${input.niche}
Town: ${input.city || 'unknown'}
Service area: ${input.serviceArea || 'unknown'}
Services: ${input.services.join(', ') || 'unknown, infer 4 to 6 typical services for this trade'}
Owner: ${input.ownerName || 'unknown'}
Caller notes: ${input.notes || 'none'}

RESEARCH (the only source of truth for facts)
${researchBlock}

## How to write

Write like a confident British tradesperson who is good at their job and does not oversell. Short sentences. Concrete nouns. Specific detail beats adjectives.

BANNED, these are the exact phrases that make a site look cheap and generic:
"quality workmanship", "built to last", "peace of mind", "second to none", "we pride ourselves", "customer satisfaction", "attention to detail", "professional service", "your trusted local", "no job too big or small", "done right, every time", "high standard", "years of experience" (unless you have the real number), "reliable and trustworthy", "competitive prices".

Never use em-dashes or en-dashes. British spelling. No exclamation marks. No hype words (best, leading, premier, unbeatable, number one).

Bad, generic, unusable:
  "Premium workmanship. Every job finished to a high, lasting standard."
Good, specific, sellable:
  "Fixed quotes. The price we write down is the price you pay, even if the job takes longer than we thought."

Bad: "Fast response. Enquiries answered quickly."
Good: "Leaks answered same day. Everything else quoted within 48 hours."

Every line should say something a competitor could not copy and paste onto their own site.

## Facts rule, this is critical

Never invent: a star rating, a review count, a testimonial, a named accreditation body (NFRC, TrustMark, Which? Trusted Trader, Checkatrade, Gas Safe), a guarantee period, an insurance figure, a number of jobs completed, or a founding year. Those are rendered separately from verified data only. If you do not have the real fact, write copy that does not need it. Never write "25 years experience" or "500+ jobs" unless that exact fact appears in the research above.

## What to produce

This is a light, editorial, high-design website. Sections do not all look alike.

1. niche_category: one of "trades", "hospitality", "professional", "beauty_wellness", "retail", "generic".
2. palette: primary (deep, rich brand colour used for dark sections, NOT a generic navy unless it genuinely fits), accent (a confident high-contrast colour for buttons and highlights, pick something with personality suited to the trade), ink (near-black body text), surface (white or a warm off-white), surface_alt (a soft tinted background for alternating sections). All hex. Make it feel considered and expensive, not default-bootstrap-blue.
3. emergency_strip: enabled true only for trades with genuine emergencies (roofing, plumbing, electrical, locksmith, pest control, glazing), with a short urgent line. Otherwise enabled false and text "".
4. eyebrow: 3 to 6 words above the headline, e.g. "Roofing specialists · Barking".
5. hero_headline: 3 to 7 words. Punchy, confident, a bit of attitude. It sits at 80px on screen so it must be short. Not a description of the company. Think headline, not sentence.
6. hero_subhead: one sentence, max 22 words, naming the trade and town and the single strongest reason to call.
7. hero_points: exactly 3 very short proof points (2 to 4 words each) for a row under the hero.
8. about_heading: 3 to 6 words, editorial, not "About us".
9. about: 2 to 3 short sentences with a real point of view. No filler.
10. why_choose: exactly 4 items. title 2 to 4 words, description one specific sentence max 16 words. Each must make a concrete promise, not a vague virtue.
11. services: one per service listed above (or 4 to 6 typical ones), name plus one specific sentence max 15 words.
12. process: exactly 4 steps from first contact to job finished. title 2 to 4 words, description max 12 words, written plainly.
13. faqs: 5 real questions a customer of this trade actually asks, with straight answers, max 30 words each.
14. trust_badges: exactly 4 short phrases, no invented certifications or numbers.
15. service_areas: 10 to 16 real UK place names genuinely near "${input.city || input.serviceArea || 'the business'}".
16. cta_headline: 4 to 7 words for the closing section. Direct and human.
17. cta_text: 2 to 4 words for buttons.
18. image_query: 2 to 3 words for a stock photo fallback.
19. sales_brief: summary (2 sentences on who they are and the sharpest angle for why they need this site), talking_points (3 bullets specific to this business), objection_prep (2 "if they say X, say Y" bullets).

Return ONLY valid JSON, no markdown fences, exactly this shape:
{"niche_category":"...","palette":{"primary":"#...","accent":"#...","ink":"#...","surface":"#...","surface_alt":"#..."},"emergency_strip":{"enabled":false,"text":""},"eyebrow":"...","hero_headline":"...","hero_subhead":"...","hero_points":["...","...","..."],"about_heading":"...","about":"...","why_choose":[{"title":"...","description":"..."}],"services":[{"name":"...","description":"..."}],"process":[{"step":1,"title":"...","description":"..."}],"faqs":[{"q":"...","a":"..."}],"trust_badges":["...","...","...","..."],"service_areas":["..."],"cta_headline":"...","cta_text":"...","image_query":"...","sales_brief":{"summary":"...","talking_points":["...","...","..."],"objection_prep":["...","..."]}}`

  try {
    const msg = await client.messages.create({
      model: SONNET,
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = extractText(msg).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(raw)
    if (!parsed.hero_headline || !parsed.palette) {
      console.error('[design.ts] response missing hero_headline/palette, stop_reason:', msg.stop_reason, 'keys:', Object.keys(parsed))
      return fallback
    }
    const arr = <T,>(v: unknown, fb: T[], max: number): T[] =>
      Array.isArray(v) && v.length ? (v as T[]).slice(0, max) : fb
    return {
      niche_category: parsed.niche_category || 'generic',
      palette: { ...fallback.palette, ...parsed.palette },
      emergency_strip: parsed.emergency_strip?.text ? parsed.emergency_strip : { enabled: false, text: '' },
      eyebrow: parsed.eyebrow || fallback.eyebrow,
      hero_headline: parsed.hero_headline,
      hero_subhead: parsed.hero_subhead || fallback.hero_subhead,
      hero_points: arr(parsed.hero_points, fallback.hero_points, 3),
      about_heading: parsed.about_heading || fallback.about_heading,
      about: parsed.about || fallback.about,
      why_choose: arr(parsed.why_choose, fallback.why_choose, 4),
      services: arr(parsed.services, fallback.services, 8),
      process: arr(parsed.process, fallback.process, 4),
      faqs: arr(parsed.faqs, fallback.faqs, 6),
      trust_badges: arr(parsed.trust_badges, fallback.trust_badges, 4),
      service_areas: arr(parsed.service_areas, fallback.service_areas, 16),
      cta_headline: parsed.cta_headline || fallback.cta_headline,
      cta_text: parsed.cta_text || fallback.cta_text,
      image_query: parsed.image_query || fallback.image_query,
      sales_brief: {
        summary: parsed.sales_brief?.summary || fallback.sales_brief.summary,
        talking_points: arr(parsed.sales_brief?.talking_points, fallback.sales_brief.talking_points, 4),
        objection_prep: arr(parsed.sales_brief?.objection_prep, fallback.sales_brief.objection_prep, 3),
      },
    }
  } catch (err) {
    console.error('[design.ts] generateSiteDesign failed:', err)
    return fallback
  }
}
