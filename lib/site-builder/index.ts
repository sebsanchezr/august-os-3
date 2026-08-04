import { researchBusiness, type BusinessResearch } from './research'
import { generateSiteDesign, type SiteDesign } from './design'
import { renderSiteHtml } from './template'
import { deployStaticSite } from './deploy'

export type { SiteDesign } from './design'
export type { BusinessResearch } from './research'

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
  // cost); when null (older v1 rows with nothing saved) research re-runs, so
  // an amend also doubles as the upgrade path for pre-v2 builds. Either way
  // the model revises the prior design in place rather than starting over.
  amend?: { notes: string; previousDesign: SiteDesign; previousResearch: BusinessResearch | null }
}

export type BuildSiteResult = {
  siteUrl: string | null
  deployed: boolean
  deployError: string | null
  design: SiteDesign
  research: BusinessResearch
}

function slugify(businessName: string, buildId: string): string {
  const base = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'site'
  return `${base}-${buildId.slice(0, 8)}`
}

// Testimonials, founder credentials and the trust bar (rating/review count)
// are assembled here from real data only, never by the model, so nothing a
// prospect could catch as fabricated on the call ever reaches the page.
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

  const phone = research.phone || input.phone

  const html = renderSiteHtml({
    businessName: research.confirmed_name || input.businessName,
    niche: input.niche,
    city: research.city || input.city,
    phone,
    address: research.address,
    photos: research.photos,
    logoUrl: research.logo_url,
    rating: research.rating,
    reviewCount: research.review_count,
    testimonials: buildTestimonials(research, input.city),
    founder: buildFounder(input.ownerName, research),
    buildId: input.buildId,
    design,
  })

  const slug = slugify(input.businessName, input.buildId)
  const deploy = await deployStaticSite(slug, html)

  return {
    siteUrl: deploy.url,
    deployed: deploy.deployed,
    deployError: deploy.error || null,
    design,
    research,
  }
}
