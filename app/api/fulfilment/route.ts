import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Terminal task statuses across both tracks (ops: completed, creative: live).
// Mirrors isTerminalStatus() in app/api/tasks/route.ts.
const TERMINAL_STATUSES = '("completed","live")'

// Fetches open tasks including collaborator_ids where the column exists,
// degrading to the plain select if migration 031 hasn't run yet.
async function fetchOpenTasks(supabase: ReturnType<typeof createSupabaseAdmin>) {
  const withCollaborators = await supabase
    .from('tasks')
    .select(`
      id, title, status, priority, due_date, assignee_id, collaborator_ids,
      assignee:profiles!tasks_assignee_id_fkey(id, name, email),
      clients(id, name)
    `)
    .is('deleted_at', null)
    .is('archived_at', null)
    .not('status', 'in', TERMINAL_STATUSES)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (withCollaborators.error?.code === '42703') {
    return supabase
      .from('tasks')
      .select(`
        id, title, status, priority, due_date, assignee_id,
        assignee:profiles!tasks_assignee_id_fkey(id, name, email),
        clients(id, name)
      `)
      .is('deleted_at', null)
      .is('archived_at', null)
      .not('status', 'in', TERMINAL_STATUSES)
      .order('due_date', { ascending: true, nullsFirst: false })
  }

  return withCollaborators
}

// GET /api/fulfilment
// Single aggregate for the fulfilment team landing dashboard: open tasks,
// meetings this week, onboardings in flight, and client health.
export async function GET(_req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const now = new Date()
    const sevenDaysOut = new Date(now.getTime() + 7 * 86400000)
    const todayStr = now.toISOString().slice(0, 10)

    const [
      { data: tasks, error: tasksErr },
      { data: meetings, error: meetingsErr },
      { data: onboardings, error: onboardingsErr },
      { data: clients, error: clientsErr },
      { count: issuesOpenCount, error: issuesErr },
      { count: pendingReportsCount, error: reportsErr },
    ] = await Promise.all([
      fetchOpenTasks(supabase),
      supabase
        .from('client_meetings')
        .select('id, type, scheduled_at, status, clients(id, name)')
        .eq('status', 'scheduled')
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', sevenDaysOut.toISOString())
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('onboardings')
        .select('id, company_name, status, health, paid')
        .not('status', 'in', '("launched","handed_off")')
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id, name, health')
        .is('archived_at', null)
        .order('name', { ascending: true }),
      supabase
        .from('client_issues')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabase
        .from('client_reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_approval'),
    ])

    if (tasksErr) return NextResponse.json({ error: tasksErr.message }, { status: 500 })
    if (meetingsErr) return NextResponse.json({ error: meetingsErr.message }, { status: 500 })
    if (onboardingsErr) return NextResponse.json({ error: onboardingsErr.message }, { status: 500 })
    if (clientsErr) return NextResponse.json({ error: clientsErr.message }, { status: 500 })
    // client_issues / client_reports have obvious status columns per migration 006,
    // but tolerate failure so the rest of the dashboard still renders.
    if (issuesErr) console.error('[fulfilment/route] client_issues count failed', issuesErr)
    if (reportsErr) console.error('[fulfilment/route] client_reports count failed', reportsErr)

    // Second lightweight lookup: collaborator_ids is a plain uuid[] column with
    // no FK Supabase can embed. Empty map if the column doesn't exist yet.
    const allCollaboratorIds = Array.from(
      new Set((tasks ?? []).flatMap((t) => (t as { collaborator_ids?: string[] }).collaborator_ids ?? []))
    )
    let collaboratorsById = new Map<string, { id: string; name: string; email: string | null }>()
    if (allCollaboratorIds.length > 0) {
      const { data: collabProfiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', allCollaboratorIds)
      collaboratorsById = new Map((collabProfiles ?? []).map((p) => [p.id, p]))
    }

    const openTasks = (tasks ?? []).map((t) => {
      const collaboratorIds = (t as { collaborator_ids?: string[] }).collaborator_ids ?? []
      return {
        ...t,
        overdue: !!t.due_date && t.due_date < todayStr,
        collaborators: collaboratorIds.map((id) => collaboratorsById.get(id)).filter(Boolean),
      }
    })

    const statusCounts: Record<string, number> = {}
    for (const t of openTasks) statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1

    const healthCounts = { red: 0, amber: 0, green: 0 }
    for (const c of clients ?? []) {
      if (c.health === 'red') healthCounts.red++
      else if (c.health === 'amber') healthCounts.amber++
      else healthCounts.green++
    }

    return NextResponse.json(
      {
        tasks: {
          open: openTasks,
          counts: statusCounts,
          overdue_count: openTasks.filter((t) => t.overdue).length,
        },
        meetings: meetings ?? [],
        onboardings: onboardings ?? [],
        clients: clients ?? [],
        health_counts: healthCounts,
        issues_open_count: issuesOpenCount ?? 0,
        pending_reports_count: pendingReportsCount ?? 0,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[fulfilment/route]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
