import { NextResponse } from 'next/server'
import { createLeadPipelineAdmin } from '@/lib/supabase-server'

// The LinkedIn Ghost engine (lead_pipeline/scripts/linkedin) writes leads,
// lead_activities and reply_conversations into the separate lead_pipeline
// Supabase project, not the OS project. This route must read from that
// project via createLeadPipelineAdmin(), which needs LEAD_PIPELINE_SUPABASE_URL
// and LEAD_PIPELINE_SUPABASE_SERVICE_KEY set. If they are not set, return a
// zeroed, clearly-flagged payload instead of crashing the page.
function emptyStats(configured: boolean, errors?: string[]) {
  return NextResponse.json({
    configured,
    kpis: {
      connects_sent_total: 0,
      connects_sent_7d: 0,
      acceptance_rate: 0,
      reply_rate: 0,
      approvals_pending: 0,
    },
    pipeline: [],
    conversations: [],
    weekly_sends: [],
    ...(errors && errors.length ? { errors } : {}),
  })
}

export async function GET() {
  let supabase
  try {
    supabase = createLeadPipelineAdmin()
  } catch (err) {
    console.error('[linkedin/stats] lead pipeline client not configured', err)
    return emptyStats(false)
  }

  const errors: string[] = []
  const track = (label: string, error: { message: string } | null) => {
    if (error) {
      console.error(`[linkedin/stats] ${label}`, error)
      errors.push(`${label}: ${error.message}`)
    }
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sixtyDaysAgo = new Date(now)
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  // Fetch all linkedin lead_activities in one shot. event_type values here
  // must match what ghost_supabase.log_activity()/run_ghost.py actually write:
  // connection_sent, connection_accepted, dm_step_{n}_sent, reply_received,
  // dm_approval_pending, replied, withdrawn.
  const { data: allActivities, error: activitiesError } = await supabase
    .from('lead_activities')
    .select('id, lead_id, event_type, occurred_at, detail')
    .eq('channel', 'linkedin')
    .gte('occurred_at', sixtyDaysAgo.toISOString())
    .order('occurred_at', { ascending: false })
  track('lead_activities', activitiesError)

  const activities = allActivities ?? []

  // --- KPI helpers ---
  const byType = (type: string) => activities.filter((a) => a.event_type === type)
  const uniqueLeads = (rows: typeof activities) => new Set(rows.map((a) => a.lead_id))

  const connectsSent = byType('connection_sent')
  const connectsSent7d = connectsSent.filter(
    (a) => new Date(a.occurred_at) >= sevenDaysAgo
  )
  const connectsAccepted = byType('connection_accepted')
  const dm1Sent = byType('dm_step_1_sent')
  const repliesReceived = byType('reply_received')
  const approvalPending = byType('dm_approval_pending')

  const connects_sent_total = connectsSent.length
  const connects_sent_7d = connectsSent7d.length

  const sentLeads = uniqueLeads(connectsSent)
  const acceptedLeads = uniqueLeads(connectsAccepted)
  const dm1Leads = uniqueLeads(dm1Sent)
  const replyLeads = uniqueLeads(repliesReceived)
  const pendingLeads = uniqueLeads(approvalPending)

  // Leads with approval_pending but no dm_step_1_sent
  const approvalsOnly = [...pendingLeads].filter((id) => !dm1Leads.has(id))

  const acceptance_rate =
    sentLeads.size > 0
      ? Math.round(((acceptedLeads.size / sentLeads.size) * 100) * 10) / 10
      : 0

  const reply_rate =
    dm1Leads.size > 0
      ? Math.round(((replyLeads.size / dm1Leads.size) * 100) * 10) / 10
      : 0

  // --- Pipeline: accepted leads not yet booked ---
  // "Not yet booked" = no reply_conversations with state='booked' or next_action='booked'
  // Simpler: accepted leads where we'll label based on DM state
  const acceptedLeadIds = [...acceptedLeads]

  let pipelineLeads: any[] = []
  if (acceptedLeadIds.length > 0) {
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('id, first_name, last_name, company_name, job_title, industry, linkedin_url, lead_score, niche, status')
      .in('id', acceptedLeadIds)
    track('leads (pipeline)', leadsError)

    const leadsMap = new Map((leadsData ?? []).map((l) => [l.id, l]))

    // Get last activity per lead
    const lastActivityMap = new Map<string, { event_type: string; occurred_at: string }>()
    for (const a of activities) {
      if (!acceptedLeads.has(a.lead_id)) continue
      if (!lastActivityMap.has(a.lead_id)) {
        lastActivityMap.set(a.lead_id, { event_type: a.event_type, occurred_at: a.occurred_at })
      }
    }

    pipelineLeads = acceptedLeadIds
      .map((id) => {
        const lead = leadsMap.get(id)
        if (!lead) return null
        const hasDm1 = dm1Leads.has(id)
        const hasReply = replyLeads.has(id)
        const lastAct = lastActivityMap.get(id)
        let status_label: 'DM Pending' | 'Following Up' | 'Replied' = 'DM Pending'
        if (hasReply) status_label = 'Replied'
        else if (hasDm1) status_label = 'Following Up'
        return {
          id: lead.id,
          first_name: lead.first_name,
          last_name: lead.last_name,
          company_name: lead.company_name,
          job_title: lead.job_title,
          industry: lead.industry,
          linkedin_url: lead.linkedin_url,
          niche: lead.niche,
          status_label,
          last_activity_at: lastAct?.occurred_at ?? null,
          last_event_type: lastAct?.event_type ?? null,
        }
      })
      .filter(Boolean)
  }

  // --- Conversations from reply_conversations ---
  const { data: convData, error: convError } = await supabase
    .from('reply_conversations')
    .select('id, lead_id, classification, state, next_action, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)
  track('reply_conversations', convError)

  const convs = convData ?? []

  // Get lead details for conversations
  const convLeadIds = [...new Set(convs.map((c) => c.lead_id).filter(Boolean))]
  let convLeadsMap = new Map<string, any>()
  if (convLeadIds.length > 0) {
    const { data: convLeadsData, error: convLeadsError } = await supabase
      .from('leads')
      .select('id, first_name, last_name, company_name')
      .in('id', convLeadIds)
    track('leads (conversations)', convLeadsError)
    for (const l of convLeadsData ?? []) {
      convLeadsMap.set(l.id, l)
    }
  }

  // Get last reply text per lead from lead_activities
  const replyActivities = byType('reply_received')
  const lastReplyMap = new Map<string, string>()
  for (const a of replyActivities) {
    if (!lastReplyMap.has(a.lead_id)) {
      const text =
        a.detail?.text ?? a.detail?.message ?? a.detail?.body ?? ''
      lastReplyMap.set(a.lead_id, String(text).slice(0, 100))
    }
  }

  const conversations = convs.map((c) => {
    const lead = convLeadsMap.get(c.lead_id)
    return {
      id: c.id,
      lead_id: c.lead_id,
      classification: c.classification,
      state: c.state,
      next_action: c.next_action,
      updated_at: c.updated_at,
      first_name: lead?.first_name ?? null,
      last_name: lead?.last_name ?? null,
      company_name: lead?.company_name ?? null,
      last_reply: lastReplyMap.get(c.lead_id) ?? null,
    }
  })

  // --- Weekly sends: last 8 weeks ---
  // connectsSent already has last 60 days
  const weeklyMap = new Map<string, number>()
  for (const a of connectsSent) {
    const d = new Date(a.occurred_at)
    // ISO week: year + week number
    const thursday = new Date(d)
    thursday.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
    const yearStart = new Date(thursday.getFullYear(), 0, 4)
    const week = Math.round(
      ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
    )
    const key = `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`
    weeklyMap.set(key, (weeklyMap.get(key) ?? 0) + 1)
  }
  const weekly_sends = [...weeklyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([week, count]) => ({ week, count }))

  return NextResponse.json({
    configured: true,
    kpis: {
      connects_sent_total,
      connects_sent_7d,
      acceptance_rate,
      reply_rate,
      approvals_pending: approvalsOnly.length,
    },
    pipeline: pipelineLeads,
    conversations,
    weekly_sends,
    ...(errors.length ? { errors } : {}),
  })
}
