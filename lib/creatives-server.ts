// Server-only: Anthropic-backed strategy drafting for the Creative Hub.
// Imported by API routes only; never import from client components.

import Anthropic from '@anthropic-ai/sdk'
import type { ClientContext, MetricsContext, KnowledgeContext } from './creatives'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const SONNET = 'claude-sonnet-5'
const STYLE_RULES = 'Never use em-dashes. Keep sentences short and direct. No corporate fluff.'
function extractText(msg: Anthropic.Message): string {
  const block = msg.content.find(b => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}


export async function draftCreativeStrategy(input: {
  clientContext: ClientContext
  focus: string
  notes: string | null
  metrics: MetricsContext[]
  knowledge: KnowledgeContext[]
}): Promise<string> {
  const { clientContext, focus, notes, metrics, knowledge } = input

  const metricsSummary = metrics.length
    ? metrics
        .map(m => `${m.date}: spend ${m.spend ?? '?'}, revenue ${m.revenue ?? '?'}, roas ${m.roas ?? '?'}, purchases ${m.purchases ?? '?'}, cpa ${m.cpa ?? '?'}`)
        .join('\n')
    : 'No recent metrics on file.'

  const knowledgeSummary = knowledge.length
    ? knowledge.map(k => `- ${k.title}: ${k.content.slice(0, 300)}`).join('\n')
    : 'No relevant research notes on file.'

  const res = await client.messages.create({
    model: SONNET,
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `You are a senior ecom creative strategist at a paid ads agency. ${STYLE_RULES}

Produce this week's creative strategy for the client below. Output markdown with:
1. Three concepts, each with: Hook, Angle, Visual direction (for STATIC image ads only, no video).
2. What to double down on based on the performance data.
3. A one-line rationale for each concept.

Client: ${clientContext.name}
Services: ${(clientContext.services ?? []).join(', ') || 'unspecified'}
Client notes: ${clientContext.notes ?? 'none'}
Target ROAS: ${clientContext.target_roas ?? 'unspecified'}
Target CPA: ${clientContext.target_cpa ?? 'unspecified'}

This week's focus (from the account owner): ${focus}
Additional notes: ${notes ?? 'none'}

Last 14 days of performance:
${metricsSummary}

Relevant research notes:
${knowledgeSummary}

Respond with ONLY the markdown strategy, no preamble.`,
    }],
  })

  return extractText(res).trim()
}
