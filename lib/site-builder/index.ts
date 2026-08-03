import { researchBusiness } from './research'
import { generateSiteDesign, type SiteDesign } from './design'
import { renderSiteHtml } from './template'
import { deployStaticSite } from './deploy'

export type { SiteDesign } from './design'

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
  // Present only when this is a re-build off caller feedback on an existing
  // build. Skips research (already have it) and asks the model to revise the
  // prior design in place rather than start over.
  amend?: { notes: string; previousDesign: SiteDesign; previousLogoUrl: string | null }
}

export type BuildSiteResult = {
  siteUrl: string | null
  deployed: boolean
  deployError: string | null
  design: SiteDesign
  logoUrl: string | null
}

function slugify(businessName: string): string {
  const base = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'site'
  const suffix = Date.now().toString(36).slice(-5)
  return `${base}-${suffix}`
}

export async function buildAndDeploySite(input: BuildSiteInput): Promise<BuildSiteResult> {
  const research = input.amend
    ? { founded_year: null, years_active: null, location_detail: null, notable_facts: [], logo_url: input.amend.previousLogoUrl }
    : await researchBusiness(input.businessName, [input.existingSiteUrl, input.googleUrl])

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

  const html = renderSiteHtml({
    businessName: input.businessName,
    niche: input.niche,
    city: input.city,
    serviceArea: input.serviceArea,
    phone: input.phone,
    logoUrl: research.logo_url,
    design,
  })

  const slug = slugify(input.businessName)
  const deploy = await deployStaticSite(slug, html)

  return {
    siteUrl: deploy.url,
    deployed: deploy.deployed,
    deployError: deploy.error || null,
    design,
    logoUrl: research.logo_url,
  }
}
