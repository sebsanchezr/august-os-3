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
