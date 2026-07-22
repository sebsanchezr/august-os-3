import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const OS_URL = 'https://augustosv3.vercel.app'
const SITE_URL = 'https://purescale.vercel.app'
// Route to the #paid-orders channel; falls back to the tasks webhook.
const WEBHOOK = process.env.DISCORD_PAID_ADS_WEBHOOK_URL || process.env.DISCORD_TASKS_WEBHOOK_URL || ''

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createSupabaseAdmin()
  const now = Date.now()
  const min = new Date(now - 36 * 3600000).toISOString() // don't nag orders older than 36h
  const max = new Date(now - 18 * 3600000).toISOString() // approaching the 24h deadline

  const { data, error } = await supabase
    .from('ce_website_forms')
    .select('id, business, email, status, created_at')
    .eq('source', 'purescale_97_order')
    .neq('status', 'delivered')
    .gte('created_at', min)
    .lte('created_at', max)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const stale = data ?? []
  if (stale.length && WEBHOOK) {
    for (const o of stale) {
      const hours = Math.floor((now - new Date(o.created_at as string).getTime()) / 3600000)
      try {
        await fetch(WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'PureScale Orders',
            embeds: [
              {
                title: '⚠️ $97 order approaching its 24h deadline — not delivered',
                color: 0xf59e0b,
                fields: [
                  { name: 'Store', value: o.business || '-' },
                  { name: 'Email', value: o.email || '-', inline: true },
                  { name: 'Age', value: `${hours}h old`, inline: true },
                  { name: 'Pipeline', value: `${OS_URL}/paid-ads/pipeline` },
                  { name: 'Customer tracker', value: `${SITE_URL}/order/${o.id}` },
                ],
                footer: { text: 'Move it forward or mark delivered' },
              },
            ],
          }),
        })
      } catch {}
    }
  }

  return NextResponse.json({ ok: true, pinged: stale.length })
}
