import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyReportReady } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// GET /api/cron/report-approvals
// Runs every 5 minutes (see vercel.json). The Mac reporter (a separate
// Python service on another machine) writes client_reports rows straight
// into Supabase with status='pending_approval' -- it never calls this app,
// so there's no API route to fire a Discord notification from at insert
// time. This job polls for rows that haven't been announced yet and posts
// them to #accounts via notifyReportReady, then stamps discord_notified_at
// so it's never announced twice.
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

  const { data: reports, error } = await supabase
    .from('client_reports')
    .select('id, type, period_start, period_end, status, clients(id, name, health)')
    .eq('status', 'pending_approval')
    .is('discord_notified_at', null)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const notified: string[] = []

  for (const report of reports ?? []) {
    const client = Array.isArray(report.clients) ? report.clients[0] : report.clients
    if (!client) continue

    notifyReportReady(
      { id: report.id, type: report.type, period_start: report.period_start, period_end: report.period_end },
      { id: client.id, name: client.name, health: client.health },
    )

    // Stamp immediately so a slow loop or overlapping run can't double-post.
    await supabase
      .from('client_reports')
      .update({ discord_notified_at: new Date().toISOString() })
      .eq('id', report.id)

    notified.push(report.id)
  }

  return NextResponse.json({ checked: reports?.length ?? 0, notified: notified.length })
}
