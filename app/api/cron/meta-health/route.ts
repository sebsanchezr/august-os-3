import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { checkMetaTokenHealth, fetchAccountInsightsAnyToken } from '@/lib/meta'
import { notifyMetaHealth, notifyMetaAccountLive } from '@/lib/discord-notify'

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

  // ── Readability transition check ────────────────────────────────────────────
  // Detect when a connected client ad account that the OS could NOT read
  // server-side becomes readable (access granted). Ping pulse once per newly
  // live account. Accounts intentionally still on the Mac reporter stay quiet:
  // we only alert on the false -> true edge, never on staying-unreadable.
  const accountReport = await checkAccountReadability()

  return NextResponse.json({
    tokens: report,
    accounts: accountReport,
    alerted: report.some((r) => r.alerted),
  })
}

async function checkAccountReadability() {
  const supabase = createSupabaseAdmin()

  const { data: clients } = await supabase
    .from('clients')
    .select('name, meta_ad_account_id')
    .eq('status', 'active')
    .is('archived_at', null)
    .not('meta_ad_account_id', 'is', null)

  const connected = (clients ?? []).filter((c) => c.meta_ad_account_id)
  if (connected.length === 0) return { checked: 0, newly_live: [] as string[] }

  // Prior readable state, keyed by account id.
  const { data: prior } = await supabase
    .from('meta_account_access')
    .select('meta_ad_account_id, readable')
  const priorReadable = new Map<string, boolean>((prior ?? []).map((r) => [r.meta_ad_account_id, r.readable]))
  const known = new Set(priorReadable.keys())

  // Cheap 1-day probe: any OK response (even empty data) means readable.
  const today = new Date().toISOString().slice(0, 10)
  const nowIso = new Date().toISOString()
  const newlyLive: { name: string; account_id: string }[] = []
  const rows: { meta_ad_account_id: string; client_name: string; readable: boolean; last_checked_at: string; first_readable_at?: string }[] = []

  for (const c of connected) {
    const accountId = String(c.meta_ad_account_id)
    const res = await fetchAccountInsightsAnyToken(accountId, today, today)
    const readable = res.ok
    // Only alert on a genuine false -> true edge for an account we already
    // tracked. First-ever sighting just seeds state, no ping (avoids alerting
    // for accounts that were already working when this check was added).
    if (known.has(accountId) && priorReadable.get(accountId) === false && readable) {
      newlyLive.push({ name: c.name, account_id: accountId })
    }
    const row: typeof rows[number] = { meta_ad_account_id: accountId, client_name: c.name, readable, last_checked_at: nowIso }
    if (readable) row.first_readable_at = nowIso
    rows.push(row)
  }

  // Upsert without clobbering an existing first_readable_at: only set it when
  // newly readable and not previously recorded.
  for (const row of rows) {
    const existingFirst = known.has(row.meta_ad_account_id) && priorReadable.get(row.meta_ad_account_id)
    const payload: Record<string, unknown> = {
      meta_ad_account_id: row.meta_ad_account_id,
      client_name: row.client_name,
      readable: row.readable,
      last_checked_at: row.last_checked_at,
    }
    if (row.readable && !existingFirst) payload.first_readable_at = row.first_readable_at
    await supabase.from('meta_account_access').upsert(payload, { onConflict: 'meta_ad_account_id' })
  }

  if (newlyLive.length) notifyMetaAccountLive(newlyLive)

  return { checked: connected.length, newly_live: newlyLive.map((a) => a.account_id) }
}
