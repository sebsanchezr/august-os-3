// AI screening + drafting for the Upwork acquisition channel.
// Every output here is a draft for a human to review and send — nothing in
// this file submits anything to Upwork.

import Anthropic from '@anthropic-ai/sdk'
import { UPWORK_ICP } from './upwork-icp'
import type { UpworkJob, UpworkMessage } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const HAIKU = 'claude-haiku-4-5-20251001'
const SONNET = 'claude-sonnet-5'

const STYLE_RULES = 'Never use em-dashes. Keep sentences short and direct. No corporate fluff.'

function extractText(msg: Anthropic.Message): string {
  const block = msg.content.find(b => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

export type FitScore = { score: number; rationale: string }

export async function scoreFit(job: Pick<UpworkJob, 'title' | 'description' | 'budget' | 'proposals_count'>): Promise<FitScore> {
  const res = await client.messages.create({
    model: HAIKU,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `We are ${UPWORK_ICP.agency}, offering: ${UPWORK_ICP.services.join(', ')}.
Ideal client signals: ${UPWORK_ICP.idealClientSignals.join('; ')}.

Score this Upwork job 1-10 for fit against our ICP, and give a one-sentence rationale.

Title: ${job.title}
Budget: ${job.budget ?? 'unspecified'}
Proposals so far: ${job.proposals_count ?? 'unknown'}
Description: ${job.description}

Respond ONLY with JSON: {"score": <1-10>, "rationale": "<one sentence>"}`,
    }],
  })

  try {
    const parsed = JSON.parse(extractText(res))
    return { score: Number(parsed.score), rationale: String(parsed.rationale) }
  } catch {
    return { score: 0, rationale: 'Could not parse AI response' }
  }
}

export async function draftProposal(job: Pick<UpworkJob, 'title' | 'description'>): Promise<string> {
  const res = await client.messages.create({
    model: SONNET,
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Write an Upwork proposal cover letter for this job. ${STYLE_RULES}

Rules that measurably improve reply rate on Upwork:
- Hook the first line on a specific detail from the job post, not a greeting.
- Reference the client by name if a name is available in the job post; otherwise skip it, do not invent one.
- 2-3 short paragraphs total.
- Include one relevant proof point from: ${UPWORK_ICP.proofPoints.join(' | ')}
- End with: "Happy to answer any questions you may have. You can also grab a slot here if useful: ${UPWORK_ICP.bookingUrl}"
- Voice: ${UPWORK_ICP.voice}

Job title: ${job.title}
Job description: ${job.description}

Respond with ONLY the cover letter text, no preamble.`,
    }],
  })
  return extractText(res).trim()
}

export async function draftLoomScript(job: Pick<UpworkJob, 'title' | 'description'>): Promise<string> {
  const res = await client.messages.create({
    model: SONNET,
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Write a 60-second Loom video script to attach to an Upwork proposal for this job. ${STYLE_RULES}

Structure: (1) quick intro, (2) the specific problem/opportunity you noticed in their post, (3) how we'd approach it, (4) soft call-to-action pointing to the booking link.
Keep it conversational, written to be read aloud on camera, not read as a letter.

Job title: ${job.title}
Job description: ${job.description}

Respond with ONLY the script text.`,
    }],
  })
  return extractText(res).trim()
}

export async function draftReply(
  job: Pick<UpworkJob, 'title' | 'description'>,
  thread: Pick<UpworkMessage, 'direction' | 'body'>[],
): Promise<string> {
  const threadText = thread.map(m => `${m.direction === 'inbound' ? 'Client' : 'Us'}: ${m.body}`).join('\n')
  const res = await client.messages.create({
    model: SONNET,
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Draft the next reply in this Upwork conversation. ${STYLE_RULES}
Move the conversation toward booking a discovery call: ${UPWORK_ICP.bookingUrl}
Keep it short, answer what was asked directly.

Job: ${job.title}

Conversation so far:
${threadText}

Respond with ONLY the reply text.`,
    }],
  })
  return extractText(res).trim()
}
