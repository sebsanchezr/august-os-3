// Single source of truth for who can see what in August OS.
// Used by components/nav.tsx (client-side nav filtering) and
// middleware.ts (server-side route enforcement).

export type Role = 'FULL_ACCESS' | 'COLD_CALLER' | 'FULFILMENT_ONLY' | 'NO_ACCESS'

export const FULL_ACCESS = ['seb@augustmarketing.co.uk']
export const COLD_CALLER = [
  'juanzy509@gmail.com',
  'fahad_naj@hotmail.com',
  'berniceokpara07@gmail.com',
  'aristarqueanakambi@hotmail.com',
  'aakeju8@gmail.com',
]
export const FULFILMENT_ONLY = ['juandagato@gmail.com', 'reachalvincases@gmail.com', 'teeagginie1@gmail.com']

// Always visible to any authenticated user, regardless of role.
// '/team' is open to every login so all staff can see the team directory.
const ALWAYS_ALLOWED_PREFIXES = ['/overview', '/updates', '/team']

// Cold Calling section of the Acquisition category. Callers also get the SOP
// library (their master SOP + objection playbook live under /sop).
const COLD_CALLER_PREFIXES = ['/dashboard', '/eod', '/resources', '/websites', '/sop']

// All Fulfilment routes.
const FULFILMENT_PREFIXES = ['/fulfilment', '/tasks', '/meetings', '/onboarding', '/accounts', '/sop', '/creatives', '/ads', '/paid-ads']

function normalize(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function getRole(email: string | null | undefined): Role {
  const normalized = normalize(email)
  if (FULL_ACCESS.includes(normalized)) return 'FULL_ACCESS'
  if (COLD_CALLER.includes(normalized)) return 'COLD_CALLER'
  if (FULFILMENT_ONLY.includes(normalized)) return 'FULFILMENT_ONLY'
  // Unknown authenticated emails get nothing but the always-allowed pages
  // until Seb explicitly assigns them a role above.
  return 'NO_ACCESS'
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function canAccessPath(email: string | null | undefined, pathname: string): boolean {
  const role = getRole(email)
  if (role === 'FULL_ACCESS') return true
  if (matchesPrefix(pathname, ALWAYS_ALLOWED_PREFIXES)) return true
  if (role === 'COLD_CALLER') return matchesPrefix(pathname, COLD_CALLER_PREFIXES)
  if (role === 'FULFILMENT_ONLY') return matchesPrefix(pathname, FULFILMENT_PREFIXES)
  return false
}

export function homePath(email: string | null | undefined): string {
  const role = getRole(email)
  if (role === 'FULL_ACCESS') return '/overview'
  if (role === 'COLD_CALLER') return '/dashboard'
  if (role === 'FULFILMENT_ONLY') return '/fulfilment'
  return '/updates'
}

// ─── Nav filtering ──────────────────────────────────────────────────────────
// Generic over whatever nav shape components/nav.tsx defines, so this stays
// the single source of truth without lib/access.ts needing to know about
// icons or labels.

type NavItemLike = { href: string }
type NavSectionLike<Item extends NavItemLike> = { items: Item[] }
type NavCategoryLike<Section extends NavSectionLike<NavItemLike>> = { sections: Section[] }

export function filterNav<
  Item extends NavItemLike,
  Section extends NavSectionLike<Item>,
  Category extends NavCategoryLike<Section>
>(nav: Category[], email: string | null | undefined): Category[] {
  return nav
    .map(category => {
      const sections = category.sections
        .map(section => ({
          ...section,
          items: section.items.filter(item => canAccessPath(email, item.href)),
        }))
        .filter(section => section.items.length > 0)
      return { ...category, sections }
    })
    .filter(category => category.sections.length > 0)
}
