// Read-only Upwork GraphQL client used to discover jobs matching our ICP.
//
// Compliance: this file must never submit proposals, spend Connects, or
// automate any write action on Upwork. Upwork's API has no proposal-submit
// mutation, and doing so via scraping/headless automation violates their ToS
// and risks a permanent account ban. Applications stay one-click-ready: a
// human copies the drafted proposal and submits it in the Upwork UI.

const TOKEN_URL = 'https://www.upwork.com/api/v3/oauth2/token'
const GRAPHQL_URL = 'https://api.upwork.com/graphql'

type UpworkJobRaw = Record<string, unknown>

export type UpworkSearchFilters = {
  keywords: string
  minBudget?: number
  expertOnly?: boolean
  paymentVerifiedOnly?: boolean
}

export type NormalizedUpworkJob = {
  upworkJobId: string
  title: string
  description: string
  budget: number | null
  budgetType: string | null
  proposalsCount: number | null
  clientCountry: string | null
  clientSize: string | null
  paymentVerified: boolean | null
  contractorTier: string | null
  jobUrl: string
  raw: UpworkJobRaw
}

class UpworkNotConfiguredError extends Error {
  constructor() {
    super('Upwork API credentials are not configured (UPWORK_CLIENT_ID/SECRET/REFRESH_TOKEN).')
    this.name = 'UpworkNotConfiguredError'
  }
}

function isConfigured(): boolean {
  return Boolean(
    process.env.UPWORK_CLIENT_ID &&
    process.env.UPWORK_CLIENT_SECRET &&
    process.env.UPWORK_REFRESH_TOKEN
  )
}

async function getAccessToken(): Promise<string> {
  if (!isConfigured()) throw new UpworkNotConfiguredError()

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.UPWORK_REFRESH_TOKEN!,
      client_id: process.env.UPWORK_CLIENT_ID!,
      client_secret: process.env.UPWORK_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) throw new Error(`Upwork token refresh failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}

const SEARCH_QUERY = `
  query MarketplaceJobSearch($query: String!) {
    marketplaceJobPostingsSearch(marketPlaceJobFilter: { titleExpression_eq: $query }) {
      edges {
        node {
          id
          title
          description
          amount { rawValue currency }
          engagement
          totalApplicants
          client {
            country
            totalReviews
            paymentVerificationStatus
          }
          contractorTier
        }
      }
    }
  }
`

function normalize(node: Record<string, any>): NormalizedUpworkJob {
  return {
    upworkJobId: node.id,
    title: node.title,
    description: node.description ?? '',
    budget: node.amount?.rawValue ? Number(node.amount.rawValue) : null,
    budgetType: node.engagement ?? null,
    proposalsCount: typeof node.totalApplicants === 'number' ? node.totalApplicants : null,
    clientCountry: node.client?.country ?? null,
    clientSize: null, // not reliably exposed by the API; best-effort, left null rather than guessed
    paymentVerified: node.client?.paymentVerificationStatus === 'VERIFIED',
    contractorTier: node.contractorTier ?? null,
    jobUrl: `https://www.upwork.com/jobs/~${node.id}`,
    raw: node,
  }
}

// Read-only marketplace search. Throws UpworkNotConfiguredError if credentials
// are missing so callers (the search cron) can skip gracefully rather than crash.
export async function searchJobs(filters: UpworkSearchFilters): Promise<NormalizedUpworkJob[]> {
  const token = await getAccessToken()

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { query: filters.keywords } }),
  })

  if (!res.ok) throw new Error(`Upwork search failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const edges = data?.data?.marketplaceJobPostingsSearch?.edges ?? []

  let jobs: NormalizedUpworkJob[] = edges.map((e: any) => normalize(e.node))

  if (filters.minBudget) jobs = jobs.filter(j => j.budget === null || j.budget >= filters.minBudget!)
  if (filters.expertOnly) jobs = jobs.filter(j => j.contractorTier === 'EXPERTISE' || j.contractorTier === null)
  if (filters.paymentVerifiedOnly) jobs = jobs.filter(j => j.paymentVerified !== false)

  return jobs
}

export { UpworkNotConfiguredError, isConfigured as isUpworkConfigured }
