import { NextRequest, NextResponse } from 'next/server'
import { checkMetaTokenHealth } from '@/lib/meta'
import { notifyMetaHealth } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET/POST /api/cron/meta-health
// Runs daily (see vercel.json). Verifies every Meta access token the OS relies
// on is still valid and not about to expire, so a silent break is caught before
// it starves the ads workspace of data. Pings the pulse Discord channel only
// when a human is actually needed: a token is invalid, or expiring within a
// week. The client user-token (META_CLIENT_ACCESS_TOKEN) is the one that
// actually expires, so this is what stops the 15 Aug lapse going unnoticed.
//
// Meta user tokens do not auto-refresh and a serverless cron cannot rewrite
// Vercel env, so reconnection is a human step; this cron guarantees the alert
// lands rather than pretending it can self-heal a revoked token.
export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}

const EXPIRY_WARN_DAYS = 7

const TOKENS: { label: string; env: string }[] = [
  { label: 'client (reads client ad accounts)', env: 'META_CLIENT_ACCESS_TOKEN' },
  { label: 'system user (house account)', env: 'META_ACCESS_TOKEN' },
]

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const report: Array<{ label: string; configured: boolean; valid: boolean; type: string | null; days_until_expiry: number | null; error: string | null; alerted: boolean }> = []

  for (const t of TOKENS) {
    const token = process.env[t.env]
    if (!token) {
      report.push({ label: t.label, configured: false, valid: false, type: null, days_until_expiry: null, error: 'not configured', alerted: false })
      continue
    }

    const health = await checkMetaTokenHealth(token)
    const expiringSoon = health.valid && health.daysUntilExpiry !== null && health.daysUntilExpiry <= EXPIRY_WARN_DAYS
    const needsAlert = !health.valid || expiringSoon

    if (needsAlert) {
      notifyMetaHealth({
        tokenOk: health.valid,
        tokenDetail: health.valid
          ? `${t.label} — ${health.type ?? 'token'} valid, expiring in ${health.daysUntilExpiry}d`
          : `${t.label} — ${health.error ?? 'invalid'}`,
        expiringInDays: expiringSoon ? health.daysUntilExpiry : null,
        unsharedAccounts: [],
      })
    }

    report.push({
      label: t.label,
      configured: true,
      valid: health.valid,
      type: health.type,
      days_until_expiry: health.daysUntilExpiry,
      error: health.error,
      alerted: needsAlert,
    })
  }

  return NextResponse.json({ tokens: report, alerted: report.some((r) => r.alerted) })
}
