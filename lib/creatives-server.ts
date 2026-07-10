// Server-only: Anthropic-backed strategy drafting for the Creative Hub.
// Imported by API routes only; never import from client components.

import Anthropic from '@anthropic-ai/sdk'
import type { ClientContext, MetricsContext, KnowledgeContext, GenConcept } from './creatives'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const SONNET = 'claude-sonnet-5'
const STYLE_RULES = 'Never use em-dashes. Keep sentences short and direct. No corporate fluff.'
function extractText(msg: Anthropic.Message): string {
  const block = msg.content.find(b => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

// Pull the first JSON array out of a model reply, tolerating code fences or
// stray preamble. Returns [] if nothing parseable is found.
function parseJsonArray(text: string): unknown[] {
  const fenced = text.replace(/```json/gi, '```').split('```').find(s => s.trim().startsWith('['))
  const raw = fenced ?? text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function coerceConcept(o: Record<string, unknown>, i: number): GenConcept {
  const aspect = String(o.aspect_ratio ?? '').trim()
  return {
    title: String(o.title ?? `Concept ${i + 1}`).slice(0, 120),
    hook: String(o.hook ?? '').slice(0, 25),
    visual_direction: String(o.visual_direction ?? o.visual ?? '').slice(0, 600),
    aspect_ratio: aspect === '4:5' ? '4:5' : '1:1',
  }
}

// Optional research grounding block (TrendTrack winning ads + Shopify best
// sellers), rendered into the prompt only when present. Null changes nothing.
function researchBlock(researchContext: string | null | undefined): string {
  if (!researchContext) return ''
  return `

Use this live research to sharpen the concepts. Draw inspiration from the winning-ad hooks and formats, and when Shopify best sellers are listed prefer their REAL product names and prices over invented ones:
${researchContext}
`
}

// Parse an approved strategy markdown doc into exactly 3 image-ready concepts.
export async function parseStrategyConcepts(
  strategyMd: string,
  clientName: string,
  researchContext?: string | null,
): Promise<GenConcept[]> {
  const res = await client.messages.create({
    model: SONNET,
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `You turn a creative strategy into image generation briefs for static ads. ${STYLE_RULES}

From the strategy below for ${clientName}, extract EXACTLY 3 concepts. For each concept return:
- "title": short concept name
- "hook": the in-image copy, MAX 25 characters, punchy. Empty string if the concept needs no text.
- "visual_direction": one vivid paragraph describing the image to generate (scene, subject, mood, lighting, composition).
- "aspect_ratio": "1:1" or "4:5" (default "1:1").

Strategy:
${strategyMd}
${researchBlock(researchContext)}
Respond with ONLY a JSON array of 3 objects. No preamble, no markdown fences.`,
    }],
  })
  const concepts = parseJsonArray(extractText(res)).slice(0, 3).map((o, i) => coerceConcept(o as Record<string, unknown>, i))
  if (concepts.length === 0) throw new Error('Could not parse any concepts from the strategy.')
  return concepts
}

// Expand a freeform brief into N image-ready concepts for Quick Generate.
export async function expandBriefConcepts(
  brief: string,
  clientName: string,
  quantity: number,
  researchContext?: string | null,
): Promise<GenConcept[]> {
  const n = Math.max(1, Math.min(4, quantity))
  const res = await client.messages.create({
    model: SONNET,
    max_tokens: 1400,
    messages: [{
      role: 'user',
      content: `You turn a media buyer's freeform brief into image generation briefs for static ads. ${STYLE_RULES}

Client: ${clientName}
Brief: ${brief}
${researchBlock(researchContext)}
Produce EXACTLY ${n} distinct static ad concept(s). For each return:
- "title": short concept name
- "hook": in-image copy, MAX 25 characters, punchy. Empty string if none needed.
- "visual_direction": one vivid paragraph describing the image (scene, subject, mood, lighting, composition).
- "aspect_ratio": "1:1" or "4:5" (default "1:1").

Respond with ONLY a JSON array of ${n} object(s). No preamble, no markdown fences.`,
    }],
  })
  const concepts = parseJsonArray(extractText(res)).slice(0, n).map((o, i) => coerceConcept(o as Record<string, unknown>, i))
  if (concepts.length === 0) throw new Error('Could not build concepts from the brief.')
  return concepts
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
