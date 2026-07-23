// Discord notification helpers for the Task Manager and Account Management.
// Called from API route handlers after mutations.
// Uses DISCORD_TASKS_WEBHOOK_URL (tasks) and DISCORD_ACCOUNTS_WEBHOOK_URL (accounts).
// Fires-and-forgets: never awaited in the critical path, so a slow Discord
// call can never break an API update.

const WEBHOOK_URL = process.env.DISCORD_TASKS_WEBHOOK_URL ?? ''
const ACCOUNTS_WEBHOOK_URL = process.env.DISCORD_ACCOUNTS_WEBHOOK_URL ?? ''
// Falls back to the tasks webhook so pipeline notifications work without a new
// secret; set DISCORD_PIPELINE_WEBHOOK_URL later to route to a dedicated channel.
const PIPELINE_WEBHOOK_URL = process.env.DISCORD_PIPELINE_WEBHOOK_URL || WEBHOOK_URL
// Falls back to the accounts webhook so onboarding notifications work without a
// new secret; set DISCORD_ONBOARDING_WEBHOOK_URL later to route to a dedicated channel.
const ONBOARDING_WEBHOOK_URL = process.env.DISCORD_ONBOARDING_WEBHOOK_URL || ACCOUNTS_WEBHOOK_URL
const UPWORK_WEBHOOK_URL = process.env.DISCORD_UPWORK_WEBHOOK_URL || WEBHOOK_URL
// Falls back to the accounts webhook so team/onboarding notifications work
// without a new secret; set DISCORD_TEAM_WEBHOOK_URL later to route to a
// dedicated channel.
const TEAM_WEBHOOK_URL = process.env.DISCORD_TEAM_WEBHOOK_URL || ACCOUNTS_WEBHOOK_URL
// Pulse agent channel (where Seb gets ops alerts). Set DISCORD_PULSE_WEBHOOK_URL
// to the pulse Discord webhook; falls back to the accounts webhook so Meta
// health alerts still land somewhere until the dedicated hook is wired.
const PULSE_WEBHOOK_URL = process.env.DISCORD_PULSE_WEBHOOK_URL || ACCOUNTS_WEBHOOK_URL
const OS_URL = 'https://augustosv3.vercel.app'

const PRIORITY_COLOUR: Record<string, number> = {
  urgent: 0xEF4444,
  high: 0xF97316,
  normal: 0x6366F1,
  low: 0x636780,
}
const PRIORITY_EMOJI: Record<string, string> = {
  urgent: '🔴', high: '🟠', normal: '🔵', low: '⚪',
}

type Embed = {
  title: string
  url?: string
  color: number
  description?: string
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string }
  timestamp?: string
}

async function post(webhookUrl: string, content: string, embeds: Embed[]): Promise<void> {
  if (!webhookUrl) return
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, embeds }),
    })
  } catch {
    // fire-and-forget: never throw
  }
}

// Same as post(), but waits for Discord to return the created message so the
// caller can persist its id (needed to route later reactions/replies back to
// the right record via the inbound bot).
async function postAndGetId(webhookUrl: string, content: string, embeds: Embed[]): Promise<string | null> {
  if (!webhookUrl) return null
  try {
    const res = await fetch(`${webhookUrl}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, embeds }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.id ?? null
  } catch {
    return null
  }
}

type NotifyTask = {
  id: string
  title: string
  priority?: string
  due_date?: string | null
  blocked_reason?: string | null
  clients?: { name: string } | null
}

type NotifyProfile = {
  name: string
  discord_user_id?: string | null
}

function mention(profile: NotifyProfile | null | undefined): string {
  return profile?.discord_user_id ? `<@${profile.discord_user_id}>` : ''
}

function clientField(task: NotifyTask) {
  return task.clients?.name ? [{ name: 'Client', value: task.clients.name, inline: true }] : []
}

// ─── Task notifications ───────────────────────────────────────────────────────

export function notifyAssigned(task: NotifyTask, assignee: NotifyProfile): void {
  const priority = task.priority ?? 'normal'
  const embed: Embed = {
    title: task.title,
    url: `${OS_URL}/tasks`,
    color: PRIORITY_COLOUR[priority] ?? 0x6366F1,
    fields: [
      { name: 'Assigned to', value: assignee.name, inline: true },
      { name: 'Priority', value: `${PRIORITY_EMOJI[priority] ?? ''} ${priority}`, inline: true },
      ...clientField(task),
      ...(task.due_date ? [{ name: 'Due', value: task.due_date, inline: true }] : []),
    ],
    footer: { text: 'August OS Tasks' },
    timestamp: new Date().toISOString(),
  }
  const m = mention(assignee)
  void post(WEBHOOK_URL, m ? `${m} You've been assigned a task.` : 'New task assigned.', [embed])
}

export function notifySentToMediaBuyer(task: NotifyTask, mediaBuyer: NotifyProfile | null): void {
  const clientName = task.clients?.name ?? 'Unknown client'
  const embed: Embed = {
    title: task.title,
    url: `${OS_URL}/tasks`,
    color: 0x8B5CF6,
    description: `Creative has been **sent to the media buyer** for **${clientName}**.`,
    footer: { text: 'August OS Tasks' },
    timestamp: new Date().toISOString(),
  }
  const m = mention(mediaBuyer)
  void post(WEBHOOK_URL, m ? `${m} Creative ready to go live.` : `Creative sent to media buyer: ${clientName}`, [embed])
}

export function notifyComment(
  task: NotifyTask,
  commenterName: string,
  commentBody: string,
  taskOwner: NotifyProfile | null,
): void {
  const preview = commentBody.length > 200 ? commentBody.slice(0, 200) + '...' : commentBody
  const embed: Embed = {
    title: task.title,
    url: `${OS_URL}/tasks`,
    color: 0x6366F1,
    description: `**${commenterName}:** ${preview}`,
    footer: { text: 'August OS Tasks' },
    timestamp: new Date().toISOString(),
  }
  const m = mention(taskOwner)
  void post(WEBHOOK_URL, m ? `${m} New comment on your task.` : 'New comment on a task.', [embed])
}

// ─── Account Management notifications ────────────────────────────────────────

type NotifyClient = { id: string; name: string; health?: string }
type NotifyReport = { id: string; type: string; period_start?: string | null; period_end?: string | null }

export function notifyReportReady(report: NotifyReport, client: NotifyClient): void {
  const typeLabels: Record<string, string> = {
    weekly_eow: 'Friday EOW Update',
    monday_kickoff: 'Monday Kickoff',
    meeting_prep: 'Meeting Prep Brief',
    meeting_followup: 'Meeting Follow-up',
    monthly_deep_dive: 'Monthly Deep Dive',
  }
  const label = typeLabels[report.type] ?? report.type
  const period = report.period_start && report.period_end
    ? ` (${report.period_start} to ${report.period_end})`
    : ''
  const embed: Embed = {
    title: `${client.name}: ${label}${period}`,
    url: `${OS_URL}/accounts/approvals`,
    color: 0x10B981,
    description: `A new report is ready for approval. Click to review, edit, and approve.`,
    fields: [
      { name: 'Client', value: client.name, inline: true },
      { name: 'Type', value: label, inline: true },
    ],
    footer: { text: 'August OS Accounts' },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, 'New report pending approval.', [embed])
}

// Fired by /api/pending-changes/inbound after the meeting agent stages
// non-task proposals (issues / health / weekly-focus) from a call transcript.
// One summary per client so Seb knows there are profile changes to review.
export function notifyPendingChanges(
  client: NotifyClient,
  counts: { task: number; issue: number; health: number; weekly_focus: number },
): void {
  const total = counts.issue + counts.health + counts.weekly_focus
  if (total === 0) return
  const parts: string[] = []
  if (counts.issue) parts.push(`${counts.issue} issue${counts.issue === 1 ? '' : 's'}`)
  if (counts.health) parts.push('a health change')
  if (counts.weekly_focus) parts.push('a weekly focus')
  const embed: Embed = {
    title: `${total} profile change${total === 1 ? '' : 's'} to review: ${client.name}`,
    url: `${OS_URL}/accounts/approvals`,
    color: counts.issue > 0 ? 0xF59E0B : 0x10B981,
    description: `Pulled from the latest call transcript. Approve or reject on the Approvals page.`,
    fields: [
      { name: 'Client', value: client.name, inline: true },
      { name: 'Staged', value: parts.join(', '), inline: true },
    ],
    footer: { text: 'August OS Accounts' },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, `New meeting proposals pending for ${client.name}.`, [embed])
}

export function notifyClientFlag(client: NotifyClient, flags: string[]): void {
  const embed: Embed = {
    title: `Early warning: ${client.name}`,
    url: `${OS_URL}/accounts/${client.id}`,
    color: 0xF59E0B,
    description: `Trigger words detected in a client communication. Review immediately.`,
    fields: [
      { name: 'Client', value: client.name, inline: true },
      { name: 'Flags', value: flags.join(', '), inline: true },
    ],
    footer: { text: 'August OS Accounts' },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, 'Client communication flag.', [embed])
}

export function notifyIssueRaised(
  issue: { id: string; category: string; severity: string; description: string },
  client: NotifyClient,
): void {
  const SEVERITY_COLOUR: Record<string, number> = {
    trust_threatening: 0xEF4444,
    major: 0xF97316,
    minor: 0xF59E0B,
  }
  const truncated = issue.description.length > 200
    ? issue.description.slice(0, 200) + '...'
    : issue.description
  const embed: Embed = {
    title: `Issue raised: ${client.name}`,
    url: `${OS_URL}/accounts/${client.id}`,
    color: SEVERITY_COLOUR[issue.severity] ?? 0xF59E0B,
    description: truncated,
    fields: [
      { name: 'Client', value: client.name, inline: true },
      { name: 'Severity', value: issue.severity.replace('_', ' '), inline: true },
      { name: 'Category', value: issue.category.replace(/_/g, ' '), inline: true },
    ],
    footer: { text: 'August OS Accounts' },
    timestamp: new Date().toISOString(),
  }
  const urgency = issue.severity === 'trust_threatening'
    ? 'URGENT: trust-threatening issue raised.'
    : 'Issue raised.'
  void post(ACCOUNTS_WEBHOOK_URL, urgency, [embed])
}

export function notifyMeetingPrepReady(
  meeting: { id: string; scheduled_at: string; type: string },
  client: NotifyClient,
  am: NotifyProfile | null,
): void {
  const dateStr = new Date(meeting.scheduled_at).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const embed: Embed = {
    title: `Prep ready: ${client.name}`,
    url: `${OS_URL}/meetings`,
    color: 0x10B981,
    description: `Meeting prep pack is ready for your **${meeting.type}** call.`,
    fields: [{ name: 'When', value: dateStr, inline: true }],
    footer: { text: 'August OS Meetings' },
    timestamp: new Date().toISOString(),
  }
  const m = mention(am)
  void post(ACCOUNTS_WEBHOOK_URL, m ? `${m} Prep pack ready for ${client.name}.` : `Prep ready: ${client.name}`, [embed])
}

export function notifyMeetingReminder(
  meeting: { id: string; scheduled_at: string; type: string },
  client: NotifyClient,
  am: NotifyProfile | null,
): void {
  const dateStr = new Date(meeting.scheduled_at).toLocaleString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' })
  const embed: Embed = {
    title: `Meeting in 2h: ${client.name}`,
    url: `${OS_URL}/meetings`,
    color: 0x6366F1,
    description: `${meeting.type.charAt(0).toUpperCase() + meeting.type.slice(1)} call at **${dateStr}**. Review prep pack before joining.`,
    footer: { text: 'August OS Meetings' },
    timestamp: new Date().toISOString(),
  }
  const m = mention(am)
  void post(ACCOUNTS_WEBHOOK_URL, m ? `${m} Meeting in 2 hours: ${client.name}.` : `Meeting reminder: ${client.name}`, [embed])
}

export function notifyMinutesApproved(client: NotifyClient, minutesSummary: string): void {
  const preview = minutesSummary.length > 500 ? minutesSummary.slice(0, 500) + '\n\n[truncated]' : minutesSummary
  const embed: Embed = {
    title: `Minutes approved: ${client.name}`,
    url: `${OS_URL}/meetings`,
    color: 0x10B981,
    description: `Meeting minutes are approved and ready to send to the client.\n\n${preview}`,
    footer: { text: 'August OS Meetings' },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, `Minutes approved for ${client.name}. Ready to send.`, [embed])
}

export function notifySlaBreach(
  comm: { id: string; summary: string; channel: string; occurred_at: string },
  client: NotifyClient,
  am: NotifyProfile | null,
  isWarning: boolean,
): void {
  const channelLabel = comm.channel.charAt(0).toUpperCase() + comm.channel.slice(1)
  const timeStr = new Date(comm.occurred_at).toLocaleString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' })
  const embed: Embed = {
    title: isWarning ? `SLA warning: ${client.name}` : `SLA BREACHED: ${client.name}`,
    url: `${OS_URL}/accounts/comms`,
    color: isWarning ? 0xF59E0B : 0xEF4444,
    description: isWarning
      ? `${channelLabel} message from ${timeStr} is approaching the SLA deadline.`
      : `${channelLabel} message from ${timeStr} is past the SLA. Reply immediately.`,
    fields: [{ name: 'Message', value: comm.summary.slice(0, 200), inline: false }],
    footer: { text: 'August OS Comms' },
    timestamp: new Date().toISOString(),
  }
  const m = mention(am)
  const urgency = isWarning ? `${m ? m + ' ' : ''}SLA warning: ${client.name}` : `${m ? m + ' ' : ''}BREACHED: ${client.name}`
  void post(ACCOUNTS_WEBHOOK_URL, urgency, [embed])
}

export function notifyInvoiceDue(client: NotifyClient, cycleDay: number): void {
  const embed: Embed = {
    title: `Invoice due today: ${client.name}`,
    url: `${OS_URL}/tasks`,
    color: 0xF59E0B,
    description: `Day ${cycleDay} of this client's 30-day billing cycle — raise the next invoice manually (no auto-billing yet).`,
    footer: { text: 'August OS Billing Reminders' },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, `💳 Invoice due today: ${client.name}`, [embed])
}

export function notifyQuietClient(client: NotifyClient, daysSince: number, am: NotifyProfile | null): void {
  const embed: Embed = {
    title: `Go touch base: ${client.name}`,
    url: `${OS_URL}/accounts/${client.id}`,
    color: 0xF59E0B,
    description: `No client contact in **${daysSince} days**. Send a proactive update before they chase you.`,
    footer: { text: 'August OS Comms' },
    timestamp: new Date().toISOString(),
  }
  const m = mention(am)
  void post(ACCOUNTS_WEBHOOK_URL, m ? `${m} Touch base with ${client.name}.` : `Quiet client: ${client.name}`, [embed])
}

export function notifyTeamQuestion(
  question: { id: string; question: string; context: string },
  client: NotifyClient | null,
  asker: NotifyProfile | null,
  target: NotifyProfile | null,
): void {
  const fields = []
  if (client) fields.push({ name: 'Client', value: client.name, inline: true })
  if (asker) fields.push({ name: 'Asked by', value: asker.name, inline: true })
  const embed: Embed = {
    title: question.question,
    url: `${OS_URL}/accounts/comms`,
    color: 0x6366F1,
    description: question.context || undefined,
    fields,
    footer: { text: 'August OS Team Questions' },
    timestamp: new Date().toISOString(),
  }
  const m = mention(target)
  void post(ACCOUNTS_WEBHOOK_URL, m ? `${m} Question from the OS:` : 'Team question:', [embed])
}

export function notifyQuestionAnswered(
  question: { question: string; answer: string },
  client: NotifyClient | null,
  answerer: NotifyProfile | null,
): void {
  const embed: Embed = {
    title: `Answered: ${question.question.slice(0, 80)}`,
    url: `${OS_URL}/accounts/comms`,
    color: 0x10B981,
    description: `**Answer:** ${question.answer}`,
    fields: client ? [{ name: 'Client', value: client.name, inline: true }] : [],
    footer: { text: `${answerer?.name ?? 'Team'} via Discord` },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, `Question answered by ${answerer?.name ?? 'team member'}.`, [embed])
}

export function notifyApprovedComms(client: NotifyClient, clientMessage: string): void {
  const preview = clientMessage.length > 1000
    ? clientMessage.slice(0, 1000) + '\n\n[truncated - copy from the Approvals page]'
    : clientMessage
  const embed: Embed = {
    title: `Approved: ${client.name}`,
    url: `${OS_URL}/accounts/${client.id}`,
    color: 0x6366F1,
    description: `**Copy and forward to the client WhatsApp group:**\n\n${preview}`,
    footer: { text: 'August OS Accounts' },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, `Message approved for ${client.name}. Forward to WA group.`, [embed])
}

// ─── Creative engine notifications ─────────────────────────────────────────────

// Fired when the ad creative engine finishes generating statics for a client,
// whether from an approved weekly strategy or an ad hoc Quick Generate run.
export function notifyCreativesGenerated(
  clientName: string,
  generated: number,
  failed: number,
  source: 'strategy' | 'quick',
): void {
  const label = source === 'quick' ? 'Quick Generate' : 'Weekly strategy'
  const embed: Embed = {
    title: `Statics ready: ${clientName}`,
    url: `${OS_URL}/creatives`,
    color: failed > 0 ? 0xF59E0B : 0x10B981,
    description: `${label} produced **${generated}** static${generated === 1 ? '' : 's'}${failed > 0 ? `, ${failed} failed` : ''}. Review in the Creative Hub.`,
    footer: { text: 'August OS Creatives' },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, `New statics for ${clientName} (${generated} ready).`, [embed])
}

// ─── Pipeline notifications ────────────────────────────────────────────────────

type NotifyDeal = {
  id: string
  prospect_name: string
  company?: string | null
  source_channel: string
  mrr_value: number
  currency: string
}

export function notifyDealWon(deal: NotifyDeal): void {
  const embed: Embed = {
    title: `Won: ${deal.prospect_name}`,
    url: `${OS_URL}/pipeline`,
    color: 0x22C55E,
    description: deal.company ? `Company: ${deal.company}` : undefined,
    fields: [
      { name: 'Channel', value: deal.source_channel, inline: true },
      { name: 'MRR', value: `${deal.mrr_value} ${deal.currency}`, inline: true },
    ],
    footer: { text: 'August OS Pipeline' },
    timestamp: new Date().toISOString(),
  }
  void post(PIPELINE_WEBHOOK_URL, `New deal won: ${deal.prospect_name}.`, [embed])
}

export function notifyDealLost(deal: NotifyDeal, reason: string): void {
  const embed: Embed = {
    title: `Lost: ${deal.prospect_name}`,
    url: `${OS_URL}/pipeline`,
    color: 0xEF4444,
    description: `Reason: ${reason}`,
    fields: [{ name: 'Channel', value: deal.source_channel, inline: true }],
    footer: { text: 'August OS Pipeline' },
    timestamp: new Date().toISOString(),
  }
  void post(PIPELINE_WEBHOOK_URL, `Deal lost: ${deal.prospect_name}.`, [embed])
}

// Follow-up draft: fired from the pipeline deal drawer's "Send follow-up" action.
// Posts a ready-to-send email draft (subject + body) so Seb can copy it straight
// from Discord and send to the prospect. Never sends anything itself.
export function notifyPipelineFollowUp(
  deal: { id: string; prospect_name: string; company?: string | null; contact_email?: string | null },
  draft: { subject: string; body: string },
  usedEmailHistory: boolean,
): void {
  const target = deal.company ? `${deal.prospect_name} (${deal.company})` : deal.prospect_name
  const embed: Embed = {
    title: `Follow-up ready: ${target}`,
    url: `${OS_URL}/pipeline`,
    color: 0x6366F1,
    description: usedEmailHistory
      ? 'Drafted from your last email thread with this contact. Copy and send.'
      : 'No prior email thread found, drafted from deal notes and your context. Copy and send.',
    fields: [
      ...(deal.contact_email ? [{ name: 'To', value: deal.contact_email, inline: true }] : []),
      { name: 'Subject', value: fmtField(draft.subject, 256) },
      { name: 'Body (copy/paste)', value: fmtField(draft.body) },
    ],
    footer: { text: 'August OS Pipeline' },
    timestamp: new Date().toISOString(),
  }
  void post(PIPELINE_WEBHOOK_URL, `Follow-up draft ready for ${target}.`, [embed])
}

export function notifyDealRotting(deal: NotifyDeal): void {
  const embed: Embed = {
    title: `Stalled: ${deal.prospect_name}`,
    url: `${OS_URL}/pipeline`,
    color: 0xF97316,
    description: 'No next action set, or the next action is overdue.',
    fields: [{ name: 'Channel', value: deal.source_channel, inline: true }],
    footer: { text: 'August OS Pipeline' },
    timestamp: new Date().toISOString(),
  }
  void post(PIPELINE_WEBHOOK_URL, `Deal stalled: ${deal.prospect_name}.`, [embed])
}

// ─── Onboarding notifications ──────────────────────────────────────────────────

type NotifyOnboarding = { id: string; company_name: string }

export function notifyOnboardingStarted(onboarding: NotifyOnboarding): void {
  const embed: Embed = {
    title: `Onboarding started: ${onboarding.company_name}`,
    url: `${OS_URL}/onboarding`,
    color: 0x6366F1,
    description: 'Contract and invoice sent. Waiting on signature.',
    footer: { text: 'August OS Onboarding' },
    timestamp: new Date().toISOString(),
  }
  void post(ONBOARDING_WEBHOOK_URL, `Onboarding started: ${onboarding.company_name}`, [embed])
}

export function notifyContractSigned(onboarding: NotifyOnboarding): void {
  const embed: Embed = {
    title: `Contract signed: ${onboarding.company_name}`,
    url: `${OS_URL}/onboarding`,
    color: 0x10B981,
    description: 'Welcome portal is now live for the client. Watch for form completion and kickoff booking.',
    footer: { text: 'August OS Onboarding' },
    timestamp: new Date().toISOString(),
  }
  void post(ONBOARDING_WEBHOOK_URL, `✍️ Contract signed: ${onboarding.company_name}`, [embed])
}

export function notifyInvoicePaid(onboarding: NotifyOnboarding): void {
  const embed: Embed = {
    title: `Invoice paid: ${onboarding.company_name}`,
    url: `${OS_URL}/onboarding`,
    color: 0x10B981,
    description: 'Payment gate cleared. This onboarding can now be marked launched.',
    footer: { text: 'August OS Onboarding' },
    timestamp: new Date().toISOString(),
  }
  void post(ONBOARDING_WEBHOOK_URL, `💰 Invoice paid: ${onboarding.company_name}`, [embed])
}

export function notifyFormCompleted(onboarding: NotifyOnboarding): void {
  const embed: Embed = {
    title: `Onboarding form completed: ${onboarding.company_name}`,
    url: `${OS_URL}/onboarding`,
    color: 0x6366F1,
    description: 'Client submitted their onboarding form. Review before the kickoff call.',
    footer: { text: 'August OS Onboarding' },
    timestamp: new Date().toISOString(),
  }
  void post(ONBOARDING_WEBHOOK_URL, `Form completed: ${onboarding.company_name}`, [embed])
}

export function notifyOnboardingLaunched(onboarding: NotifyOnboarding): void {
  const embed: Embed = {
    title: `🚀 Launched: ${onboarding.company_name}`,
    url: `${OS_URL}/accounts`,
    color: 0x22C55E,
    description: 'Handed off to Accounts. First-week wins engine starts now — daily wins for the next 7 days.',
    footer: { text: 'August OS Onboarding' },
    timestamp: new Date().toISOString(),
  }
  void post(ONBOARDING_WEBHOOK_URL, `🚀 Launched: ${onboarding.company_name}`, [embed])
}

export function notifyKickoffBooked(onboarding: NotifyOnboarding, when: string): void {
  const embed: Embed = {
    title: `Kickoff booked: ${onboarding.company_name}`,
    url: `${OS_URL}/onboarding`,
    color: 0x8B5CF6,
    description: `Kickoff call booked for **${when}**.`,
    footer: { text: 'August OS Onboarding' },
    timestamp: new Date().toISOString(),
  }
  void post(ONBOARDING_WEBHOOK_URL, `Kickoff booked: ${onboarding.company_name}`, [embed])
}

// ─── Upwork acquisition notifications ──────────────────────────────────────────

type NotifyUpworkJob = {
  id: string
  title: string
  budget: number | null
  budget_type: string | null
  proposals_count: number | null
  job_url: string
  fit_score: number | null
  fit_rationale: string | null
}

export async function notifyUpworkOpportunity(job: NotifyUpworkJob): Promise<string | null> {
  const budgetStr = job.budget ? `$${job.budget.toLocaleString()}${job.budget_type === 'hourly' ? '/hr' : ''}` : 'Not specified'
  const embed: Embed = {
    title: job.title,
    url: job.job_url,
    color: 0x14A800,
    description: job.fit_rationale ?? undefined,
    fields: [
      { name: 'Fit score', value: `${job.fit_score ?? '?'}/10`, inline: true },
      { name: 'Budget', value: budgetStr, inline: true },
      { name: 'Proposals', value: String(job.proposals_count ?? '?'), inline: true },
      { name: 'Review + apply', value: `${OS_URL}/upwork`, inline: false },
    ],
    footer: { text: 'August OS Upwork' },
    timestamp: new Date().toISOString(),
  }
  return postAndGetId(UPWORK_WEBHOOK_URL, `New Upwork opportunity: ${job.title}`, [embed])
}

// ─── Meeting lifecycle notifications ───────────────────────────────────────────

function fmtField(text: string, max = 1000): string {
  const trimmed = text.trim() || 'None'
  return trimmed.length > max ? trimmed.slice(0, max) + '...' : trimmed
}

// Cancellation: fired when a scheduled meeting is cancelled from the OS
// (e.g. the client's contact is on holiday). Keeps the AM's Discord in the
// loop so no one shows up to a call that no longer exists.
export function notifyMeetingCancelled(
  meeting: { id: string; scheduled_at: string; type: string },
  client: NotifyClient,
  reason: string | null,
): void {
  const dateStr = new Date(meeting.scheduled_at).toLocaleString('en-GB', {
    timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  const embed: Embed = {
    title: `Cancelled: ${client.name}`,
    url: `${OS_URL}/meetings`,
    color: 0x636780,
    description: `${meeting.type.charAt(0).toUpperCase() + meeting.type.slice(1)} call at **${dateStr}** was cancelled.${reason ? `\n\n**Reason:** ${reason}` : ''}`,
    footer: { text: 'August OS Meetings' },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, `Meeting cancelled: ${client.name}`, [embed])
}

// Monday sync: summary of the week's meetings pulled from Google Calendar.
export function notifyCalendarSynced(summary: { added: number; updated: number; skipped: number; weekLabel: string }): void {
  if (summary.added === 0 && summary.updated === 0) return
  const embed: Embed = {
    title: `This week's meetings synced: ${summary.weekLabel}`,
    url: `${OS_URL}/meetings`,
    color: 0x6366F1,
    fields: [
      { name: 'Added', value: String(summary.added), inline: true },
      { name: 'Updated', value: String(summary.updated), inline: true },
      { name: 'Unmatched (no client found)', value: String(summary.skipped), inline: true },
    ],
    footer: { text: 'August OS Meetings' },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, 'Calendar synced for the week ahead.', [embed])
}

type PrepClient = { id: string; name: string }
type PrepMeeting = { id: string; scheduled_at: string; type: string }

// Prep pack ready a few hours before a call: posted with the actual agenda
// and pre-meeting message inline so Seb can copy/paste directly from Discord.
// (Distinct from notifyMeetingPrepReady above, which is the older generic
// "click through to review" notification fired on manual meeting edits.)
export function notifyMeetingPrepPack(
  client: PrepClient,
  meeting: PrepMeeting,
  agenda: string,
  preMeetingMessage: string,
): void {
  const when = new Date(meeting.scheduled_at).toLocaleString('en-GB', {
    weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  })
  const embed: Embed = {
    title: `Prep ready: ${client.name} (${when})`,
    url: `${OS_URL}/meetings`,
    color: 0x10B981,
    fields: [
      { name: 'Agenda', value: fmtField(agenda) },
      { name: 'Pre-meeting message (copy/paste to client)', value: fmtField(preMeetingMessage) },
    ],
    footer: { text: 'August OS Meetings' },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, `Prep pack ready for ${client.name}, call at ${when}.`, [embed])
}

// Post-meeting follow-up: after a transcript is found for a past call, the
// followup cron drafts a client-facing recap and posts it here so Seb can
// copy/paste and send. Distinct from minutes (internal) and from the prep pack.
export function notifyPostMeetingMessage(
  client: PrepClient,
  meeting: PrepMeeting,
  message: string,
): void {
  const when = new Date(meeting.scheduled_at).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  })
  const embed: Embed = {
    title: `Follow-up ready: ${client.name} (${when})`,
    url: `${OS_URL}/meetings`,
    color: 0x8B5CF6,
    fields: [
      { name: 'Post-meeting message (copy/paste to client)', value: fmtField(message) },
    ],
    footer: { text: 'August OS Meetings' },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, `Transcript in. Follow-up message ready for ${client.name}.`, [embed])
}

// ─── Team & Staff Onboarding notifications ─────────────────────────────────

// New hire: posts a ready-to-forward welcome message in the embed description
// so Seb can copy it straight into WhatsApp. Fired once, when an onboarding
// is created (staff_onboardings.welcome_sent flips to true).
export function notifyStaffWelcome(name: string, role: string): void {
  const roleLabel = role.replace(/_/g, ' ')
  const welcomeCopy = `Hey ${name} 👋 Welcome to the August Marketing sales team! Buzzing to have you on the phones. Next steps: sign your contract, send your details so we get your OS login sorted, and Juan will book your intro call. This is 100% commission — the more you call, the more you earn, no cap. Let's make some money. — Team August`
  const embed: Embed = {
    title: `New hire: ${name}`,
    url: `${OS_URL}/team/onboarding`,
    color: 0x22C55E,
    description: welcomeCopy,
    fields: [{ name: 'Role', value: roleLabel, inline: true }],
    footer: { text: 'August OS Team' },
    timestamp: new Date().toISOString(),
  }
  void post(TEAM_WEBHOOK_URL, `New hire started onboarding: ${name}`, [embed])
}

// Provision login reminder: fired when an onboarding moves to
// 'details_collected' — the candidate has sent what's needed for Seb to
// create their Supabase auth user and add them to lib/access.ts.
export function notifyProvisionLogin(name: string, email?: string | null): void {
  const embed: Embed = {
    title: `Provision OS login: ${name}`,
    url: `${OS_URL}/team/onboarding`,
    color: 0x6366F1,
    description: `Details are in. Create their Supabase auth user and add them to lib/access.ts (COLD_CALLER or FULFILMENT_ONLY as appropriate).${email ? `\n\n**Login email:** ${email}` : ''}`,
    footer: { text: 'August OS Team' },
    timestamp: new Date().toISOString(),
  }
  void post(TEAM_WEBHOOK_URL, `Provision login for ${name}.`, [embed])
}

// Generic reminder embed used by the daily team-onboarding cron.
export function notifyStaffReminder(title: string, body: string): void {
  const embed: Embed = {
    title,
    url: `${OS_URL}/team/onboarding`,
    color: 0xF59E0B,
    description: body,
    footer: { text: 'August OS Team' },
    timestamp: new Date().toISOString(),
  }
  void post(TEAM_WEBHOOK_URL, title, [embed])
}

// ─── Meta connection health (pulse agent) ──────────────────────────────────

// Fired by the daily meta-health cron only when something needs a human: the
// access token is invalid/expired, or client ad accounts are no longer shared
// with our system user (so server-side ingestion silently returns nothing).
// Routes to the pulse channel so Seb sees it alongside other ops alerts.
export function notifyMetaHealth(opts: {
  tokenOk: boolean
  tokenDetail: string
  expiringInDays: number | null
  unsharedAccounts: { name: string; account_id: string }[]
}): void {
  const { tokenOk, tokenDetail, expiringInDays, unsharedAccounts } = opts
  const critical = !tokenOk
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Token', value: tokenOk ? '✅ valid' : '❌ invalid / expired', inline: true },
  ]
  if (expiringInDays !== null) {
    fields.push({ name: 'Expires in', value: `${expiringInDays}d`, inline: true })
  }
  if (unsharedAccounts.length) {
    fields.push({
      name: `Ad accounts not shared (${unsharedAccounts.length})`,
      value: fmtField(unsharedAccounts.map((a) => `- ${a.name} (${a.account_id})`).join('\n')),
    })
  }
  const embed: Embed = {
    title: critical ? '🔴 Meta connection needs reauth' : '⚠️ Meta connection: action needed',
    url: `${OS_URL}/accounts`,
    color: critical ? 0xEF4444 : 0xF59E0B,
    description: critical
      ? `Meta token problem: ${tokenDetail}. Server-side ad ingestion is degraded until it is reconnected. Reconnect the token and update its value in Vercel.`
      : `Meta token expiring soon${expiringInDays !== null ? ` (${expiringInDays}d)` : ''}: ${tokenDetail}. Reconnect it before it lapses and update its value in Vercel, or the ads workspace loses fresh data.${unsharedAccounts.length ? ' Accounts not visible to this token are listed below for reference.' : ''}`,
    fields,
    footer: { text: 'August OS · Meta health' },
    timestamp: new Date().toISOString(),
  }
  const content = critical
    ? '@here Meta token is down. Ad metrics ingestion has stopped until it is reconnected.'
    : 'Meta health: client ad accounts need sharing (see below).'
  void post(PULSE_WEBHOOK_URL, content, [embed])
}

// One-time positive nudge: a connected client ad account that the OS could not
// read server-side has just become readable (access was granted), so its
// metrics now sync via the free daily cron instead of only the Mac reporter.
export function notifyMetaAccountLive(accounts: { name: string; account_id: string }[]): void {
  if (!accounts.length) return
  const embed: Embed = {
    title: `Server-side ad sync now live (${accounts.length})`,
    url: `${OS_URL}/accounts`,
    color: 0x22C55E,
    description: `These client ad accounts are now readable by the OS token, so their metrics sync automatically each morning (05:45 UTC) without depending on the Mac reporter:\n\n${fmtField(accounts.map((a) => `- ${a.name} (${a.account_id})`).join('\n'))}`,
    footer: { text: 'August OS · Meta health' },
    timestamp: new Date().toISOString(),
  }
  void post(PULSE_WEBHOOK_URL, `✅ ${accounts.length} client ad account(s) now syncing server-side.`, [embed])
}

// Daily staleness check: metrics ingestion is pushed by the external Mac
// reporter, so this warns when a client's numbers have gone stale (>24h) and
// the OS is showing old data.
export function notifyMetricsStale(
  stale: { id: string; name: string; hoursOld: number | null }[],
): void {
  if (!stale.length) return
  const lines = stale
    .map(c => `- ${c.name}: ${c.hoursOld === null ? 'no metrics ever recorded' : `${c.hoursOld}h old`}`)
    .join('\n')
  const embed: Embed = {
    title: `Client metrics are stale (${stale.length})`,
    url: `${OS_URL}/accounts`,
    color: 0xF59E0B,
    description: `These clients have no fresh performance data in the last 24h. Check the Mac reporter is running.\n\n${fmtField(lines)}`,
    footer: { text: 'August OS Accounts' },
    timestamp: new Date().toISOString(),
  }
  void post(ACCOUNTS_WEBHOOK_URL, `Metrics staleness alert: ${stale.length} client(s) behind.`, [embed])
}
