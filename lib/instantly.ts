// Thin Instantly v2 API client used by the cold-email metrics sync cron.
// Mirrors revenue_engine/instantly_api.py but stays read-only: this file only
// pulls campaign + analytics data, it never sends email or mutates campaigns.

const INSTANTLY_BASE = 'https://api.instantly.ai/api/v2'

export type InstantlyCampaign = {
  id: string
  name: string
}

export type InstantlyDailyRow = {
  date: string
  sent: number
  replies: number
  bounced: number
}

export function isInstantlyConfigured(): boolean {
  return Boolean(process.env.INSTANTLY_API_KEY)
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.INSTANTLY_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function req(path: string, params?: Record<string, string>) {
  const url = new URL(`${INSTANTLY_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), { headers: headers(), cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Instantly API ${path} failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

// GET /campaigns, paginated via starting_after so new campaigns are always
// picked up automatically. No name/id filtering: every campaign in the
// workspace flows into ce_metrics_daily.
export async function listCampaigns(): Promise<InstantlyCampaign[]> {
  const items: InstantlyCampaign[] = []
  let startingAfter: string | undefined
  for (let page = 0; page < 20; page++) {
    const params: Record<string, string> = { limit: '100' }
    if (startingAfter) params.starting_after = startingAfter
    const data = await req('/campaigns', params)
    const batch: any[] = data?.items ?? []
    for (const c of batch) {
      if (c?.id) items.push({ id: c.id, name: c.name ?? c.id })
    }
    startingAfter = data?.next_starting_after
    if (!startingAfter || batch.length === 0) break
  }
  return items
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

// GET /campaigns/analytics/daily?campaign_id=&start_date=&end_date=
// Instantly returns one row per day for the campaign. Field names have
// shifted across Instantly's v2 revisions, so read defensively across the
// known aliases rather than assuming one exact shape.
export async function dailyAnalytics(
  campaignId: string,
  startDate: string,
  endDate: string
): Promise<InstantlyDailyRow[]> {
  const data = await req('/campaigns/analytics/daily', {
    campaign_id: campaignId,
    start_date: startDate,
    end_date: endDate,
  })
  const rows: any[] = Array.isArray(data) ? data : (data?.items ?? data?.data ?? [])
  return rows
    .map((r) => ({
      date: r.date ?? r.day ?? r.stat_date,
      sent: num(r.sent ?? r.emails_sent ?? r.emails_sent_count),
      replies: num(r.replies ?? r.unique_replies ?? r.reply_count),
      bounced: num(r.bounced ?? r.bounces ?? r.bounced_count),
    }))
    .filter((r) => Boolean(r.date))
}
