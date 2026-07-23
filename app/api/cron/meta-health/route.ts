import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { checkMetaTokenHealth, listAccessibleAdAccountIds } from '@/lib/meta'
import { notifyMetaHealth } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET/POST /api/cron/meta-health
// Runs daily (see vercel.json). Verifies the Meta connection is healthy so a
// silent break is caught before it starves the ads workspace of data:
//   1. Is the access token still valid / not near expiry?
//   2. Are all connected client ad accounts actually shared with our system
//      user? An unshared account is the silent cause of "connected but no data",
//      because server-side ingestion returns a permission error, not rows.
// Only pings the pulse Discord channel when a human is actually needed
// (token down, token expiring soon, or accounts need sharing). Meta system-user
// tokens do not auto-refresh and a serverless cron cannot rewrite Vercel env,
// so reconnection is a human step; this cron makes sure that step never gets
// missed rather than pretending it can self-heal a revoked token.
export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}

const EXPIRY_WARN_DAYS = 7

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const health = await checkMetaTokenHealth()

  // Token down: nothing else can be checked. Alert and stop.
  if (!health.valid) {
    notifyMetaHealth({
      tokenOk: false,
      tokenDetail: health.error ?? 'unknown reason',
      expiringInDays: null,
      unsharedAccounts: [],
    })
    return NextResponse.json({ token_ok: false, error: health.error, alerted: true })
  }

  const supabase = createSupabaseAdmin()

  // Connected, active clients whose accounts should be pullable server-side.
  const { data: clients } = await supabase
    .from('clients')
    .select('name, meta_ad_account_id')
    .eq('status', 'active')
    .is('archived_at', null)
    .not('meta_ad_account_id', 'is', null)

  const connected = (clients ?? []).filter((c) => c.meta_ad_account_id)

  // Which of those accounts can the token actually read?
  const accessible = await listAccessibleAdAccountIds()
  let unshared: { name: string; account_id: string }[] = []
  let accessibleError: string | null = null
  if (accessible.ok) {
    unshared = connected
      .filter((c) => !accessible.data.has(String(c.meta_ad_account_id).replace(/^act_/, '')))
      .map((c) => ({ name: c.name, account_id: String(c.meta_ad_account_id) }))
  } else {
    accessibleError = accessible.error
  }

  // Alert only on the genuine "connection is breaking" signal: the token is
  // expiring soon. We deliberately do NOT alert merely because client accounts
  // are unshared with this token: ingestion runs through the external reporter
  // (which holds its own access), and an actual data stall is already caught by
  // the metrics-staleness cron. The unshared list is still returned below for
  // debugging so it is visible without generating daily false alarms.
  const expiringSoon = health.daysUntilExpiry !== null && health.daysUntilExpiry <= EXPIRY_WARN_DAYS

  if (expiringSoon) {
    notifyMetaHealth({
      tokenOk: true,
      tokenDetail: `${health.type ?? 'token'} valid but expiring`,
      expiringInDays: health.daysUntilExpiry,
      unsharedAccounts: unshared,
    })
  }

  return NextResponse.json({
    token_ok: true,
    token_type: health.type,
    expires_in_days: health.daysUntilExpiry,
    scopes: health.scopes,
    connected_accounts: connected.length,
    unshared_accounts: unshared,
    accessible_check_error: accessibleError,
    alerted: expiringSoon,
  })
}
