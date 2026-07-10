import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['active', 'paused', 'churned'] as const
const VALID_SERVICES = ['paid_ads', 'creatives'] as const
const VALID_CALL_DAYS = [1, 2, 3, 4, 5] as const

// GET /api/accounts
// Returns all clients with AM profile join, open task count, 7-day metrics rollup, next meeting
export async function GET(_req: NextRequest) {
  const supabase = createSupabaseAdmin()

  const { data: clients, error } = await supabase
    .from('clients')
    .select(`
      *,
      am:profiles!clients_am_profile_id_fkey(id, name, role)
    `)
    .is('archived_at', null)
    .order('health', { ascending: true })
    // red first (sorts alphabetically: amber, green, red -- handled client-side)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clientIds = (clients ?? []).map((c) => c.id)

  // Open task counts per client
  const { data: taskCounts } = await supabase
    .from('tasks')
    .select('client_id')
    .in('client_id', clientIds)
    .is('deleted_at', null)
    .is('archived_at', null)
    .not('status', 'in', '("done","live")')

  const taskCountMap: Record<string, number> = {}
  for (const t of taskCounts ?? []) {
    if (t.client_id) taskCountMap[t.client_id] = (taskCountMap[t.client_id] ?? 0) + 1
  }

  // Next upcoming meeting per client
  const now = new Date().toISOString()
  const { data: meetings } = await supabase
    .from('client_meetings')
    .select('id, client_id, scheduled_at, type')
    .in('client_id', clientIds)
    .eq('status', 'scheduled')
    .gte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })

  const nextMeetingMap: Record<string, { id: string; scheduled_at: string; type: string }> = {}
  for (const m of meetings ?? []) {
    if (!nextMeetingMap[m.client_id]) nextMeetingMap[m.client_id] = m
  }

  // 7-day metrics rollup
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const since = sevenDaysAgo.toISOString().slice(0, 10)

  const { data: metrics7d } = await supabase
    .from('client_metrics_daily')
    .select('client_id, spend, revenue, roas, purchases')
    .in('client_id', clientIds)
    .gte('date', since)

  const metrics7dMap: Record<string, { spend: number; revenue: number; roas_avg: number | null }> = {}
  const roas7dAccum: Record<string, { sum: number; count: number }> = {}
  for (const m of metrics7d ?? []) {
    if (!metrics7dMap[m.client_id]) metrics7dMap[m.client_id] = { spend: 0, revenue: 0, roas_avg: null }
    metrics7dMap[m.client_id].spend += m.spend ?? 0
    metrics7dMap[m.client_id].revenue += m.revenue ?? 0
    if (m.roas != null) {
      if (!roas7dAccum[m.client_id]) roas7dAccum[m.client_id] = { sum: 0, count: 0 }
      roas7dAccum[m.client_id].sum += m.roas
      roas7dAccum[m.client_id].count += 1
    }
  }
  for (const id of Object.keys(roas7dAccum)) {
    metrics7dMap[id].roas_avg = roas7dAccum[id].sum / roas7dAccum[id].count
  }

  // Open issue counts
  const { data: issueCounts } = await supabase
    .from('client_issues')
    .select('client_id')
    .in('client_id', clientIds)
    .in('status', ['open', 'resolving'])

  const issueCountMap: Record<string, number> = {}
  for (const i of issueCounts ?? []) {
    issueCountMap[i.client_id] = (issueCountMap[i.client_id] ?? 0) + 1
  }

  const enriched = (clients ?? []).map((c) => ({
    ...c,
    open_task_count: taskCountMap[c.id] ?? 0,
    open_issue_count: issueCountMap[c.id] ?? 0,
    next_meeting: nextMeetingMap[c.id] ?? null,
    metrics_7d: metrics7dMap[c.id] ?? null,
  }))

  return NextResponse.json({ accounts: enriched })
}

// POST /api/accounts
export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const status = (body.status as string) || 'active'
  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  const services = (body.services as string[]) || []
  const invalidServices = services.filter((s) => !(VALID_SERVICES as readonly string[]).includes(s))
  if (invalidServices.length > 0) {
    return NextResponse.json({ error: `invalid services: ${invalidServices.join(', ')}` }, { status: 400 })
  }

  if (body.call_day != null) {
    const day = Number(body.call_day)
    if (!(VALID_CALL_DAYS as readonly number[]).includes(day as 1 | 2 | 3 | 4 | 5)) {
      return NextResponse.json({ error: 'call_day must be 1 (Mon) through 5 (Fri)' }, { status: 400 })
    }
  }

  const { data: client, error } = await supabase
    .from('clients')
    .insert({
      name: (body.name as string).trim(),
      status,
      services,
      contact_name:       body.contact_name ?? null,
      contact_email:      body.contact_email ?? null,
      wa_group_name:      body.wa_group_name ?? null,
      mrr:                body.mrr ?? null,
      currency:           body.currency ?? 'GBP',
      start_date:         body.start_date ?? null,
      renewal_date:       body.renewal_date ?? null,
      am_profile_id:      body.am_profile_id ?? null,
      meta_ad_account_id: body.meta_ad_account_id ?? null,
      trendtrak_ids:      body.trendtrak_ids ?? [],
      target_roas:        body.target_roas ?? null,
      target_cpa:         body.target_cpa ?? null,
      monthly_budget:     body.monthly_budget ?? null,
      call_day:           body.call_day ?? null,
      call_time:          body.call_time ?? null,
      notes:              body.notes ?? null,
    })
    .select()
    .single()

  if (error || !client) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  return NextResponse.json({ account: client }, { status: 201 })
}
