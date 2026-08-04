import { researchBusiness, type BusinessResearch } from './research'
import { generateSiteDesign, type SiteDesign } from './design'
import { renderSiteHtml, type Stat } from './template'
import { deployStaticSite } from './deploy'
import { assessBuildQuality, type QualityCheck } from './quality'

export type { SiteDesign } from './design'
export type { BusinessResearch } from './research'
export type { QualityCheck } from './quality'

export type BuildSiteInput = {
  businessName: string
  niche: string
  city: string | null
  serviceArea: string | null
  phone: string | null
  services: string[]
  ownerName: string | null
  notes: string | null
  googleUrl: string | null
  existingSiteUrl: string | null
  buildId: string
  // Present only when this is a re-build off caller feedback on an existing
  // build. When previousResearch is available it's reused (no repeat Apify
  // cost); when null (older rows with nothing saved) research re-runs, so an
  // amend also doubles as the upgrade path for pre-v2 builds. Either way the
  // model revises the prior design rather than starting over.
  amend?: { notes: string; previousDesign: SiteDesign; previousResearch: BusinessResearch | null }
}

export type BuildSiteResult = {
  siteUrl: string | null
  deployed: boolean
  deployError: string | null
  design: SiteDesign
  research: BusinessResearch
  quality: QualityCheck
}

function slugify(businessName: string, buildId: string): string {
  const base = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'site'
  return `${base}-${buildId.slice(0, 8)}`
}

// "Peak roofer ltd" reads as paperwork, not a brand. Strip the company suffix
// for everything customer-facing and title-case it; the full legal name is
// kept for the footer and schema.org.
function displayName(raw: string): string {
  const stripped = raw
    .replace(/[,\s]+(ltd|limited|llp|llc|plc|inc|co\.?|company|group)\.?$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || raw
  // Only re-case words that are all-lower or all-upper, so deliberate casing
  // like "McRoof" or "JW Roofing" survives untouched.
  return stripped
    .split(' ')
    .map(w => (w === w.toLowerCase() || w === w.toUpperCase()) && w.length > 2
      ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      : w)
    .join(' ')
}

function monogramOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// Stats are assembled from verified research only. Anything the model could
// have invented (jobs completed, years trading, guarantee lengths) never gets
// here, so a prospect can't catch a fabricated number on the call.
function buildStats(research: BusinessResearch, design: SiteDesign): Stat[] {
  const stats: Stat[] = []
  if (research.rating != null) stats.push({ value: research.rating.toFixed(1), label: 'Google rating' })
  if (research.review_count != null && research.review_count > 0) {
    stats.push({ value: `${research.review_count}`, label: 'Google reviews' })
  }
  if (research.years_active) stats.push({ value: research.years_active, label: 'In the trade' })
  else if (research.founded_year) stats.push({ value: `Est. ${research.founded_year}`, label: 'Trading since' })
  if (design.service_areas.length >= 4) {
    stats.push({ value: `${design.service_areas.length}`, label: 'Areas covered' })
  }
  if (design.services.length) stats.push({ value: `${design.services.length}`, label: 'Services offered' })
  // A band of one lonely number looks worse than no band at all.
  return stats.length >= 3 ? stats.slice(0, 4) : []
}

function buildFounder(ownerName: string | null, research: BusinessResearch) {
  if (!ownerName) return null
  return {
    name: ownerName,
    role: 'Owner',
    credentials: research.years_active ? `${research.years_active} in the trade` : null,
  }
}

function buildTestimonials(research: BusinessResearch, city: string | null) {
  return research.review_texts.map(text => ({
    quote: text.length > 220 ? `${text.slice(0, 217)}...` : text,
    location: research.city || city || '',
    source: 'Google review',
  }))
}

export async function buildAndDeploySite(input: BuildSiteInput): Promise<BuildSiteResult> {
  const research = input.amend?.previousResearch
    ?? await researchBusiness(input.businessName, input.city, input.googleUrl, input.existingSiteUrl)

  const design = await generateSiteDesign({
    businessName: input.businessName,
    niche: input.niche,
    city: input.city,
    serviceArea: input.serviceArea,
    services: input.services,
    ownerName: input.ownerName,
    notes: input.notes,
    research,
    amend: input.amend ? { notes: input.amend.notes, previousDesign: input.amend.previousDesign } : undefined,
  })

  const legalName = research.confirmed_name || input.businessName
  const name = displayName(legalName)

  const html = renderSiteHtml({
    businessName: name,
    legalName,
    monogram: monogramOf(name),
    niche: input.niche,
    city: research.city || input.city,
    phone: research.phone || input.phone,
    address: research.address,
    photos: research.photos,
    // The logo lifted from their Google listing is a real brand asset; a
    // scraped og:image/favicon is a distant second best.
    logoUrl: research.brand_logo_url || research.logo_url,
    rating: research.rating,
    reviewCount: research.review_count,
    testimonials: buildTestimonials(research, input.city),
    founder: buildFounder(input.ownerName, research),
    stats: buildStats(research, design),
    buildId: input.buildId,
    design,
  })

  const slug = slugify(input.businessName, input.buildId)
  const deploy = await deployStaticSite(slug, html)

  const quality = assessBuildQuality({
    deployed: deploy.deployed,
    deployError: deploy.error || null,
    design,
    research,
  })

  return {
    siteUrl: deploy.url,
    deployed: deploy.deployed,
    deployError: deploy.error || null,
    design,
    research,
    quality,
  }
}
