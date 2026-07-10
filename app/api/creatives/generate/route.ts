import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { isMissingTableError, MIGRATION_MISSING_MESSAGE } from '@/lib/creatives'
import type { GenConcept } from '@/lib/creatives'
import { parseStrategyConcepts, expandBriefConcepts } from '@/lib/creatives-server'
import { buildResearchContext, type ResearchClient } from '@/lib/research-server'
import { generateImage, buildImagePrompt, uploadImage, ImageGenError } from '@/lib/creatives-images'
import { notifyCreativesGenerated } from '@/lib/discord-notify'

// Vercel Hobby caps API routes at 60s. We generate concepts concurrently to
// stay inside that budget.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// POST /api/creatives/generate
// Two modes:
//   1. Strategy mode  { strategy_id }              -> parse the approved
//      strategy_md into 3 concepts and generate an image for each.
//   2. Quick Generate { client_id, brief, quantity } -> expand the freeform
//      brief into `quantity` concepts and generate. No strategy row is created;
//      outputs are stored with strategy_id null.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const strategy_id = (body.strategy_id as string) || null
  const client_id = (body.client_id as string) || null
  const brief = (body.brief as string)?.trim() || ''
  const quantity = Math.max(1, Math.min(4, Number(body.quantity) || 1))

  if (!strategy_id && (!client_id || !brief)) {
    return NextResponse.json({ error: 'Provide either strategy_id, or client_id + brief.' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // ── Resolve the client + concepts for whichever mode we are in ─────────────
  let resolvedClientId = client_id
  let clientName = ''
  let clientNotes: string | null = null
  let researchClient: ResearchClient | null = null
  let concepts: GenConcept[]
  const source: 'strategy' | 'quick' = strategy_id ? 'strategy' : 'quick'

  try {
    if (strategy_id) {
      const { data: strat, error: stratErr } = await supabase
        .from('creative_strategies')
        .select('*, client:clients(id, name, notes, trendtrak_ids)')
        .eq('id', strategy_id)
        .single()
      if (stratErr || !strat) {
        if (isMissingTableError(stratErr)) return NextResponse.json({ error: MIGRATION_MISSING_MESSAGE }, { status: 409 })
        return NextResponse.json({ error: stratErr?.message ?? 'Strategy not found' }, { status: 404 })
      }
      if (!strat.strategy_md) return NextResponse.json({ error: 'Strategy has no content to generate from.' }, { status: 400 })

      resolvedClientId = strat.client_id
      const c = strat.client as { name?: string; notes?: string | null; trendtrak_ids?: string[] | null } | null
      clientName = c?.name ?? 'the client'
      clientNotes = c?.notes ?? null
      researchClient = { id: String(strat.client_id), name: clientName, trendtrak_ids: c?.trendtrak_ids ?? null }

      // Flip to generating so the UI reflects work in flight.
      await supabase.from('creative_strategies').update({ status: 'generating' }).eq('id', strategy_id)

      // Research grounding (TrendTrack + Shopify). Null when neither is configured.
      const research = await buildResearchContext(researchClient)
      concepts = await parseStrategyConcepts(strat.strategy_md, clientName, research)
    } else {
      const { data: clientRow, error: clientErr } = await supabase
        .from('clients')
        .select('id, name, notes, trendtrak_ids')
        .eq('id', resolvedClientId)
        .single()
      if (clientErr || !clientRow) return NextResponse.json({ error: clientErr?.message ?? 'Client not found' }, { status: 404 })
      clientName = clientRow.name
      clientNotes = clientRow.notes ?? null
      researchClient = { id: clientRow.id, name: clientRow.name, trendtrak_ids: clientRow.trendtrak_ids ?? null }

      // Research grounding (TrendTrack + Shopify). Null when neither is configured.
      const research = await buildResearchContext(researchClient)
      concepts = await expandBriefConcepts(brief, clientName, quantity, research)
    }
  } catch (err) {
    // Concept parsing failed before any image work. Revert generating flag.
    if (strategy_id) await supabase.from('creative_strategies').update({ status: 'approved' }).eq('id', strategy_id)
    return NextResponse.json({ error: `Concept parsing failed: ${(err as Error).message}` }, { status: 502 })
  }

  // Pull brand asset links for richer prompts (best effort).
  const { data: assetRows } = await supabase
    .from('client_creative_assets')
    .select('title, kind, url, notes')
    .eq('client_id', resolvedClientId)
    .limit(12)
  const brandAssets = (assetRows ?? []).map(a => `${a.title}${a.notes ? ` (${a.notes})` : ''}`)

  // ── Generate every concept concurrently ───────────────────────────────────
  const stamp = Date.now()
  const results = await Promise.allSettled(
    concepts.map(async (concept, i) => {
      const prompt = buildImagePrompt(concept, { name: clientName, notes: clientNotes, assets: brandAssets })
      const img = await generateImage(prompt, concept.aspect_ratio)
      const ext = img.mime.includes('jpeg') ? 'jpg' : 'png'
      const path = `${resolvedClientId}/${strategy_id ?? 'adhoc'}/${stamp}-${i}.${ext}`
      const { publicUrl, storagePath } = await uploadImage(supabase, img.buffer, img.mime, path)
      return { concept, i, publicUrl, storagePath, prompt, provider: img.provider }
    })
  )

  // Insert one output row per concept (success or failure).
  let generated = 0
  let failed = 0
  let firstError = ''
  const rows = results.map((r, i) => {
    const concept = concepts[i]
    if (r.status === 'fulfilled') {
      generated++
      return {
        strategy_id, client_id: resolvedClientId, concept_index: i,
        concept_title: concept.title, prompt_used: r.value.prompt,
        image_url: r.value.publicUrl, storage_path: r.value.storagePath,
        status: 'generated', error: null,
      }
    }
    failed++
    const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
    if (!firstError) firstError = msg
    return {
      strategy_id, client_id: resolvedClientId, concept_index: i,
      concept_title: concept.title, prompt_used: null,
      image_url: null, storage_path: null,
      status: 'failed', error: msg,
    }
  })

  const { data: inserted, error: insertErr } = await supabase
    .from('creative_strategy_outputs')
    .insert(rows)
    .select('*')
  if (insertErr) {
    if (strategy_id) await supabase.from('creative_strategies').update({ status: 'approved' }).eq('id', strategy_id)
    if (isMissingTableError(insertErr)) {
      return NextResponse.json({ error: 'Run migration 035 to enable creative outputs.' }, { status: 409 })
    }
    // Images were generated and uploaded, but we could not record them.
    return NextResponse.json({ error: `Images generated but could not be saved: ${insertErr.message}` }, { status: 500 })
  }

  // ── Total failure: nothing generated. Revert so nothing strands. ───────────
  if (generated === 0) {
    if (strategy_id) await supabase.from('creative_strategies').update({ status: 'approved' }).eq('id', strategy_id)
    const actionable = results.find(r => r.status === 'rejected' && r.reason instanceof ImageGenError)
    const message = actionable && actionable.status === 'rejected'
      ? (actionable.reason as Error).message
      : `Generation failed for all concepts. ${firstError}`.trim()
    return NextResponse.json({ error: message, generated: 0, failed }, { status: 502 })
  }

  // ── Partial or full success: mark delivered. ───────────────────────────────
  if (strategy_id) {
    await supabase.from('creative_strategies').update({ status: 'delivered' }).eq('id', strategy_id)
  }

  notifyCreativesGenerated(clientName, generated, failed, source)

  return NextResponse.json({
    delivered: true,
    generated,
    failed,
    strategy_id,
    client_id: resolvedClientId,
    outputs: inserted ?? [],
  })
}
