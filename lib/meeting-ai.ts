// AI drafting for the meeting prep pack cron (app/api/cron/meeting-prep/route.ts).
// Same client/model setup as lib/upwork-ai.ts. Every output here is a draft
// for Seb to review/copy-paste; nothing here sends anything to a client.

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SONNET = 'claude-sonnet-5'
const STYLE_RULES = 'Never use em-dashes. Keep sentences short and direct. No corporate fluff.'

function extractText(msg: Anthropic.Message): string {
  const block = msg.content.find(b => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

export type PrepPackInput = {
  clientName: string
  contactName: string | null
  meetingType: string
  scheduledAt: string
  metricsThisWeek: { spend: number; revenue: number; roas: number | null; purchases: number } | null
  metricsPriorWeek: { spend: number; revenue: number; roas: number | null; purchases: number } | null
  openTasks: { title: string; status: string }[]
  openIssues: { category: string; severity: string; description: string }[]
  talkingPoints: string[]
  lastMeetingMinutes: string | null
  lastMeetingActionItems: { title: string; status: string }[]
}

export type PrepPack = {
  prepMd: string
  agenda: string
  preMeetingMessage: string
}

function fmtMetrics(m: PrepPackInput['metricsThisWeek']): string {
  if (!m) return 'No metrics recorded for this period.'
  return `Spend £${m.spend.toFixed(0)}, Revenue £${m.revenue.toFixed(0)}, ROAS ${m.roas?.toFixed(2) ?? 'n/a'}, Purchases ${m.purchases}`
}

export async function draftPrepPack(input: PrepPackInput): Promise<PrepPack> {
  const prompt = `You are preparing Seb, an agency owner at August Marketing (UK paid media agency), for an upcoming client call. ${STYLE_RULES}

Client: ${input.clientName}
Contact: ${input.contactName ?? 'unknown, use the client name'}
Meeting type: ${input.meetingType}
Scheduled: ${input.scheduledAt}

Performance this week vs prior week:
This week: ${fmtMetrics(input.metricsThisWeek)}
Prior week: ${fmtMetrics(input.metricsPriorWeek)}

Open tasks for this client:
${input.openTasks.length ? input.openTasks.map(t => `- ${t.title} (${t.status})`).join('\n') : 'None'}

Open issues:
${input.openIssues.length ? input.openIssues.map(i => `- [${i.severity}] ${i.category}: ${i.description}`).join('\n') : 'None'}

Unconsumed talking points (things flagged to raise on this call):
${input.talkingPoints.length ? input.talkingPoints.map(p => `- ${p}`).join('\n') : 'None'}

Last meeting's minutes:
${input.lastMeetingMinutes ?? 'No previous meeting on record.'}

Last meeting's action items and current status:
${input.lastMeetingActionItems.length ? input.lastMeetingActionItems.map(a => `- ${a.title} (${a.status})`).join('\n') : 'None'}

Produce exactly three sections, each starting with the exact header shown (no markdown ### before the header word, just the header word followed by a colon on its own line), nothing else before or after:

PREP_PACK:
A short internal brief for Seb (bullet points): performance vs prior period, open tasks/issues to be aware of, whether last meeting's action items were completed, and what needs addressing on this call. Factual, no padding.

AGENDA:
3-5 short bullet points, the actual agenda for the call, based on the above.

PRE_MEETING_MESSAGE:
A ready-to-send message from Seb to the client confirming the call and agenda. Friendly, professional, under 80 words. Start with "Hi ${input.contactName ?? input.clientName},". Mention the call time and 2-3 agenda items. End with something like "See you then." No em-dashes.`

  const res = await client.messages.create({
    model: SONNET,
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = extractText(res)
  const prepMatch = text.match(/PREP_PACK:\s*([\s\S]*?)(?=AGENDA:|$)/)
  const agendaMatch = text.match(/AGENDA:\s*([\s\S]*?)(?=PRE_MEETING_MESSAGE:|$)/)
  const messageMatch = text.match(/PRE_MEETING_MESSAGE:\s*([\s\S]*)$/)

  return {
    prepMd: (prepMatch?.[1] ?? text).trim(),
    agenda: (agendaMatch?.[1] ?? '').trim(),
    preMeetingMessage: (messageMatch?.[1] ?? '').trim(),
  }
}
