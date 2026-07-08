import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyMetricsStale } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET/POST /api/cron/metrics-staleness
// Runs daily (see vercel.json). Performance metrics are pushed into
// client_metrics_daily by the external Mac reporter, so the OS cannot pull them
// on a schedule. Instead this checks each active client's most recent metrics
// row and, if the freshest data is more than 24h old (or missing entirely),
// posts a single Discord alert so a stalled reporter is caught before Seb walks
// into a call on stale numbers.
export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createSupabaseAdmin()

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('status', 'active')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const stale: { id: string; name: string; hoursOld: number | null }[] = []

  for (const client of clients ?? []) {
    const { data: latest } = await supabase
      .from('client_metrics_daily')
      .select('updated_at')
      .eq('client_id', client.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!latest?.updated_at) {
      stale.push({ id: client.id, name: client.name, hoursOld: null })
      continue
    }

    const hoursOld = Math.round((now - new Date(latest.updated_at).getTime()) / 3600000)
    if (hoursOld > 24) {
      stale.push({ id: client.id, name: client.name, hoursOld })
    }
  }

  if (stale.length) notifyMetricsStale(stale)

  return NextResponse.json({ checked: clients?.length ?? 0, stale: stale.length })
}
