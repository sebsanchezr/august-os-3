// AI drafting for the pipeline "Send follow-up" action
// (app/api/pipeline/[id]/follow-up/route.ts).
// Same client/model setup as lib/meeting-ai.ts. Output is a draft for Seb to
// review, copy from Discord, and send himself. Nothing here sends to the prospect.

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SONNET = 'claude-sonnet-5'
const STYLE_RULES = 'Never use em-dashes. Keep sentences short and direct. No corporate fluff. Write like a founder, not a marketer.'

function extractText(msg: Anthropic.Message): string {
  const block = msg.content.find(b => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

export type PriorEmail = {
  from: string
  subject: string
  date: string
  body: string
}

export type FollowUpInput = {
  prospectName: string
  company: string | null
  contactEmail: string
  stage: string
  notes: string | null
  // The last exchange we found in Gmail with this address, newest last. Empty
  // when Gmail is not configured or no thread exists yet.
  priorEmails: PriorEmail[]
  // Free-text context Seb typed in the follow-up modal (any new info to weave in).
  context: string
}

export type FollowUpDraft = {
  subject: string
  body: string
}

function fmtPriorEmails(emails: PriorEmail[]): string {
  if (!emails.length) {
    return 'No prior email history found with this contact. Treat this as a first follow-up based on the notes and context below.'
  }
  return emails
    .map(e => `--- Email from ${e.from} on ${e.date} ---\nSubject: ${e.subject}\n${e.body.slice(0, 2000)}`)
    .join('\n\n')
}

export async function draftPipelineFollowUp(input: FollowUpInput): Promise<FollowUpDraft> {
  const prompt = `You are Seb, agency owner at August Marketing (a UK paid media / ad creative agency). Write a short, warm, high-converting follow-up email to a prospect. ${STYLE_RULES}

Prospect: ${input.prospectName}${input.company ? ` at ${input.company}` : ''}
Their email: ${input.contactEmail}
Current pipeline stage: ${input.stage.replace(/_/g, ' ')}
Internal notes on this deal: ${input.notes || 'none'}

Last conversation we had with them (use this to reference what was already said, match their tone, and pick up naturally where it left off):
${fmtPriorEmails(input.priorEmails)}

New context Seb wants woven into this follow-up:
${input.context || 'none, just a natural nudge to keep the conversation moving'}

Write the follow-up now. Rules:
- Reference the last conversation naturally if there was one.
- One clear call to action (usually a call or a reply).
- Keep it under 150 words.
- No tired subject lines like "Just following up" or "Checking in".

Return ONLY valid JSON, no markdown fences, in this exact shape:
{"subject": "the email subject line", "body": "the full email body with line breaks"}`

  const msg = await client.messages.create({
    model: SONNET,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = extractText(msg).trim()
  // Model may wrap in fences despite instructions; strip them defensively.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    return {
      subject: String(parsed.subject ?? '').trim() || 'Following up',
      body: String(parsed.body ?? '').trim() || cleaned,
    }
  } catch {
    // Fall back to the raw text as the body if JSON parsing fails.
    return { subject: 'Following up', body: raw }
  }
}
