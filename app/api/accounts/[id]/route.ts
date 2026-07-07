import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

// GET /api/accounts/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { data: client, error } = await supabase
    .from('clients')
    .select(`*, am:profiles!clients_am_profile_id_fkey(id, name, role, discord_user_id)`)
    .eq('id', id)
    .single()

  if (error || !client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Open tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, status, priority, due_date, assignee_id, profiles!tasks_assignee_id_fkey(id, name)')
    .eq('client_id', id)
    .is('deleted_at', null)
    .is('archived_at', null)
    .not('status', 'in', '("done","live")')
    .order('due_date', { ascending: true, nullsFirst: false })

  // Open issues
  const { data: issues } = await supabase
    .from('client_issues')
    .select('id, category, severity, status, description, raised_at')
    .eq('client_id', id)
    .in('status', ['open', 'resolving'])
    .order('raised_at', { ascending: false })

  // Pending approval reports
  const { data: pendingReports } = await supabase
    .from('client_reports')
    .select('id, type, period_start, period_end, created_at')
    .eq('client_id', id)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false })

  // 30-day metrics
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const { data: metrics30d } = await supabase
    .from('client_metrics_daily')
    .select('date, spend, revenue, roas, purchases, cpa, top_creatives')
    .eq('client_id', id)
    .gte('date', thirtyDaysAgo.toISOString().slice(0, 10))
    .order('date', { ascending: true })

  // Next upcoming meeting
  const { data: meetings } = await supabase
    .from('client_meetings')
    .select('id, type, scheduled_at, agenda, status')
    .eq('client_id', id)
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(3)

  // Recent comms (last 10 with SLA state)
  const { data: recentComms } = await supabase
    .from('client_comms_log')
    .select('id, direction, channel, summary, sentiment, flags, requires_response, response_due_at, responded_at, sla_breached, occurred_at, logged_by, logger:profiles!client_comms_log_logged_by_fkey(id, name)')
    .eq('client_id', id)
    .order('occurred_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    account: client,
    open_tasks: tasks ?? [],
    open_issues: issues ?? [],
    pending_reports: pendingReports ?? [],
    metrics_30d: metrics30d ?? [],
    upcoming_meetings: meetings ?? [],
    recent_comms: recentComms ?? [],
  })
}

// PATCH /api/accounts/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Whitelist updatable fields
  const allowed = [
    'name', 'status', 'services', 'contact_name', 'contact_email', 'wa_group_name',
    'mrr', 'currency', 'start_date', 'renewal_date', 'am_profile_id',
    'meta_ad_account_id', 'trendtrak_ids', 'target_roas', 'target_cpa',
    'monthly_budget', 'call_day', 'call_time', 'notes', 'health',
  ]
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data: client, error } = await supabase
    .from('clients')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error || !client) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  return NextResponse.json({ account: client })
}

// DELETE /api/accounts/[id]
// Soft-delete: sets archived_at so the client is hidden from lists but records are retained.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { data: client, error } = await supabase
    .from('clients')
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('archived_at', null)
    .select()
    .single()

  if (error || !client) return NextResponse.json({ error: error?.message ?? 'Delete failed' }, { status: 500 })
  return NextResponse.json({ ok: true, account: client })
}
