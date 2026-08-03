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
  const research = await researchBusiness(input.businessName, [input.existingSiteUrl, input.googleUrl])

  const design = await generateSiteDesign({
    businessName: input.businessName,
    niche: input.niche,
    city: input.city,
    serviceArea: input.serviceArea,
    services: input.services,
    ownerName: input.ownerName,
    notes: input.notes,
    research,
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
