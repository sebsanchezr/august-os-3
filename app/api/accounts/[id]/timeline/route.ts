import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

// GET /api/accounts/[id]/timeline
// Merges reports, meetings, issues, and comms log into a single chronological feed.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const [reportsRes, meetingsRes, issuesRes, commsRes] = await Promise.all([
    supabase
      .from('client_reports')
      .select('id, type, period_start, period_end, status, created_at, approved_at, sent_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('client_meetings')
      .select('id, type, scheduled_at, status, agenda')
      .eq('client_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(50),

    supabase
      .from('client_issues')
      .select('id, category, severity, status, description, raised_at, resolved_at')
      .eq('client_id', id)
      .order('raised_at', { ascending: false })
      .limit(50),

    supabase
      .from('client_comms_log')
      .select('id, direction, channel, summary, sentiment, flags, occurred_at, logger:profiles!client_comms_log_logged_by_fkey(id, name)')
      .eq('client_id', id)
      .order('occurred_at', { ascending: false })
      .limit(50),
  ])

  type TimelineEntry = {
    id: string
    kind: 'report' | 'meeting' | 'issue' | 'comm'
    occurred_at: string
    data: Record<string, unknown>
  }

  const entries: TimelineEntry[] = [
    ...(reportsRes.data ?? []).map((r) => ({
      id: r.id,
      kind: 'report' as const,
      occurred_at: r.created_at,
      data: r,
    })),
    ...(meetingsRes.data ?? []).map((m) => ({
      id: m.id,
      kind: 'meeting' as const,
      occurred_at: m.scheduled_at,
      data: m,
    })),
    ...(issuesRes.data ?? []).map((i) => ({
      id: i.id,
      kind: 'issue' as const,
      occurred_at: i.raised_at,
      data: i,
    })),
    ...(commsRes.data ?? []).map((c) => ({
      id: c.id,
      kind: 'comm' as const,
      occurred_at: c.occurred_at,
      data: c,
    })),
  ]

  entries.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))

  return NextResponse.json({ timeline: entries.slice(0, 100) })
}
