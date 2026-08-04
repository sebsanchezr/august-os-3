// Deterministic post-build check, independent of the AI call that just ran.
// The design/copy prompt can degrade (API error, truncated response, Apify
// finding nothing) without ever throwing, since every stage is built to fall
// back gracefully rather than crash the request. That's correct behaviour
// for uptime, but it means a build can silently come out generic. This is
// the tripwire: it never blocks a build, it just makes sure a human sees the
// word "Needs review" instead of assuming every green tick is the real bar.

import type { SiteDesign } from './design'
import type { BusinessResearch } from './research'

// The exact filler this pipeline used to produce before the copy prompt was
// rewritten. If any of these slip back in (a bad Sonnet response, a future
// regression), the build gets flagged rather than sold as premium.
const BANNED_PHRASES = [
  'quality workmanship', 'built to last', 'peace of mind', 'second to none',
  'we pride ourselves', 'customer satisfaction', 'attention to detail',
  'professional service', 'your trusted local', 'no job too big or small',
  'done right, every time', 'high standard', 'reliable and trustworthy',
  'competitive prices', 'years of experience',
]

export type QualityCheck = {
  passed: boolean
  warnings: string[]
}

function containsBannedPhrase(design: SiteDesign): string | null {
  const haystack = [
    design.hero_headline, design.hero_subhead, design.about,
    ...design.why_choose.flatMap(w => [w.title, w.description]),
    ...design.services.flatMap(s => [s.name, s.description]),
  ].join(' | ').toLowerCase()
  return BANNED_PHRASES.find(p => haystack.includes(p)) || null
}

export function assessBuildQuality(input: {
  deployed: boolean
  deployError: string | null
  design: SiteDesign
  research: BusinessResearch
}): QualityCheck {
  const warnings: string[] = []

  if (!input.deployed) warnings.push(`Site did not deploy: ${input.deployError || 'unknown error'}`)
  if (!input.research.phone) warnings.push('No real phone number found (Apify + form both empty)')
  if (!input.research.photos.length && !input.research.brand_logo_url) {
    warnings.push('No real photos or logo found, hero is running on the CSS fallback')
  }
  if (input.design.why_choose.length < 4) warnings.push('Copy pass looks like it fell back (why_choose incomplete)')
  if (input.design.faqs.length < 3) warnings.push('Copy pass looks like it fell back (faqs incomplete)')

  const banned = containsBannedPhrase(input.design)
  if (banned) warnings.push(`Generic filler phrase slipped through: "${banned}"`)

  return { passed: warnings.length === 0, warnings }
}
