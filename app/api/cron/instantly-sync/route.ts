import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { isInstantlyConfigured, listCampaigns, dailyAnalytics } from '@/lib/instantly'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET/POST /api/cron/instantly-sync
// Pulls every Instantly campaign (no hardcoded name filter, so new campaigns
// flow in automatically) and upserts its last-7-days daily analytics into
// ce_metrics_daily. Idempotent: reruns just overwrite the same 7-day window,
// which also backfills any day the cron missed.
export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}

function fmt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!isInstantlyConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'INSTANTLY_API_KEY not configured' })
  }

  const supabase = createSupabaseAdmin()

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  const startDate = fmt(start)
  const endDate = fmt(end)

  let campaigns: Awaited<ReturnType<typeof listCampaigns>> = []
  try {
    campaigns = await listCampaigns()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list Instantly campaigns' },
      { status: 502 }
    )
  }

  let rowsUpserted = 0
  let usedFallbackSchema = false
  const errors: string[] = []

  for (const campaign of campaigns) {
    let daily: Awaited<ReturnType<typeof dailyAnalytics>> = []
    try {
      daily = await dailyAnalytics(campaign.id, startDate, endDate)
    } catch (e) {
      errors.push(`${campaign.name}: ${e instanceof Error ? e.message : 'analytics fetch failed'}`)
      continue
    }
    if (daily.length === 0) continue

    // Preferred path: migration 029 has been applied, campaign_id/campaign_name
    // exist and (date, campaign_id) is uniquely indexed.
    const richRows = daily.map((d) => ({
      date: d.date,
      campaign: campaign.name,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      sent: d.sent,
      replies: d.replies,
      bounces: d.bounced,
    }))

    const { error: richError } = await supabase
      .from('ce_metrics_daily')
      .upsert(richRows, { onConflict: 'date,campaign_id' })

    if (!richError) {
      rowsUpserted += richRows.length
      continue
    }

    // Fallback: migration 029 not applied yet (columns/index missing). Fall
    // back to the original (date, campaign) unique constraint from
    // 004_cold_email.sql so the sync still works pre-migration.
    const isSchemaMiss =
      richError.code === '42703' || // undefined_column
      richError.code === '42P10' || // invalid on-conflict spec
      /column|on conflict|constraint/i.test(richError.message ?? '')

    if (!isSchemaMiss) {
      errors.push(`${campaign.name}: ${richError.message}`)
      continue
    }

    usedFallbackSchema = true
    const legacyRows = daily.map((d) => ({
      date: d.date,
      campaign: campaign.name,
      sent: d.sent,
      replies: d.replies,
      bounces: d.bounced,
    }))
    const { error: legacyError } = await supabase
      .from('ce_metrics_daily')
      .upsert(legacyRows, { onConflict: 'date,campaign' })

    if (legacyError) {
      errors.push(`${campaign.name}: ${legacyError.message}`)
    } else {
      rowsUpserted += legacyRows.length
    }
  }

  return NextResponse.json({
    campaigns: campaigns.length,
    rowsUpserted,
    usedFallbackSchema,
    errors: errors.length ? errors : undefined,
  })
}
