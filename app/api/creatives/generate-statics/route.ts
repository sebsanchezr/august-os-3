import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase-server'
import { isMissingTableError } from '@/lib/creatives'
import type { CreativeGenerationResult } from '@/lib/creatives'
import {
  detectNoAiRule,
  buildGroundedPrompt,
  generateStatic,
  uploadStatic,
  StaticGenError,
  type NoteSource,
  type PromptContext,
} from '@/lib/statics-gen'
import { notifyCreativesGenerated } from '@/lib/discord-notify'

// Nano banana image calls run one per requested image inside this window.
export const maxDuration = 60

// POST /api/creatives/generate-statics
// Body: { client_id, brief?, angle?, count<=6 }
// Grounds a static-ad prompt from the client's DB context (clients.notes +
// onboarding_forms + creative asset notes) plus the brief/angle, then calls the
// Gemini image API once per requested image and stores the public URLs.
//
// Respects a hard "no AI imagery" brand rule found in the client's asset/notes:
// if present, it REFUSES and names the rule rather than generating banned art.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const client_id = (body.client_id as string) || ''
  const brief = ((body.brief as string) ?? '').trim()
  const angle = ((body.angle as string) ?? '').trim()
  const count = Math.max(1, Math.min(6, Number(body.count) || 4))

  if (!client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // ── Load client + grounding context ────────────────────────────────────────
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, notes, onboarding_id')
    .eq('id', client_id)
    .maybeSingle()
  if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  let businessOverview: string | null = null
  let targetAudience: string | null = null
  let onboardingExtra: string | null = null
  if (client.onboarding_id) {
    const { data: form } = await supabase
      .from('onboarding_forms')
      .select('business_overview, target_audience, extra')
      .eq('onboarding_id', client.onboarding_id)
      .maybeSingle()
    if (form) {
      businessOverview = form.business_overview ?? null
      targetAudience = form.target_audience ?? null
      onboardingExtra = form.extra ? JSON.stringify(form.extra).slice(0, 600) : null
    }
  }

  const { data: assetRows } = await supabase
    .from('client_creative_assets')
    .select('title, notes')
    .eq('client_id', client_id)
    .limit(30)
  const assets = assetRows ?? []
  const assetNotes = assets
    .map((a) => `${a.title}${a.notes ? `: ${a.notes}` : ''}`)
    .filter(Boolean)

  // Who requested this (best effort; null when no session cookie is present).
  let requestedBy: string | null = null
  try {
    const authed = createSupabaseServer()
    const { data: { user } } = await authed.auth.getUser()
    requestedBy = user?.id ?? null
  } catch {
    requestedBy = null
  }

  // ── Hard "no AI imagery" brand rule: refuse rather than generate ────────────
  const noteSources: NoteSource[] = [
    { label: 'client notes', text: client.notes },
    { label: 'onboarding extra', text: onboardingExtra },
    ...assets.map((a) => ({ label: `asset "${a.title}"`, text: a.notes })),
  ]
  const banned = detectNoAiRule(noteSources)
  if (banned) {
    const message = `Refusing to generate AI statics for ${client.name}. A no-AI-imagery rule is on file (${banned.source}): "${banned.rule}". Use real product photography with text overlay instead.`
    // Record the refusal so it is auditable.
    await supabase.from('creative_generations').insert({
      client_id,
      requested_by: requestedBy,
      brief: brief || null,
      angle: angle || null,
      count,
      status: 'failed',
      error: message,
      results: [],
    })
    return NextResponse.json({ refused: true, error: message }, { status: 422 })
  }

  // ── Create the batch row ────────────────────────────────────────────────────
  const { data: gen, error: genErr } = await supabase
    .from('creative_generations')
    .insert({
      client_id,
      requested_by: requestedBy,
      brief: brief || null,
      angle: angle || null,
      count,
      status: 'generating',
      results: [],
    })
    .select('*')
    .single()
  if (genErr) {
    if (isMissingTableError(genErr)) {
      return NextResponse.json({ error: 'Run migration 037 to enable Generate Statics.' }, { status: 409 })
    }
    return NextResponse.json({ error: genErr.message }, { status: 500 })
  }

  const promptCtx: PromptContext = {
    clientName: client.name,
    clientNotes: client.notes ?? null,
    businessOverview,
    targetAudience,
    onboardingExtra,
    assetNotes,
    brief,
    angle,
  }

  // ── Generate every image concurrently (one Gemini call each) ────────────────
  const stamp = Date.now()
  const settled = await Promise.allSettled(
    Array.from({ length: count }, async (_unused, i) => {
      const prompt = buildGroundedPrompt(promptCtx, i + 1, count)
      const img = await generateStatic(prompt)
      const ext = img.mime.includes('jpeg') ? 'jpg' : 'png'
      const path = `${client_id}/${gen.id}/${stamp}-${i}.${ext}`
      const { publicUrl, storagePath } = await uploadStatic(supabase, img.buffer, img.mime, path)
      return { index: i, publicUrl, storagePath, prompt }
    })
  )

  const results: CreativeGenerationResult[] = []
  const outputRows: Record<string, unknown>[] = []
  let generated = 0
  let failed = 0
  let firstError = ''

  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      generated++
      results.push({ index: i, image_url: r.value.publicUrl, storage_path: r.value.storagePath, error: null })
      outputRows.push({
        strategy_id: null,
        client_id,
        concept_index: i,
        concept_title: brief ? brief.slice(0, 80) : 'Generated static',
        prompt_used: r.value.prompt,
        image_url: r.value.publicUrl,
        storage_path: r.value.storagePath,
        status: 'generated',
        error: null,
      })
    } else {
      failed++
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
      if (!firstError) firstError = msg
      results.push({ index: i, image_url: null, storage_path: null, error: msg })
    }
  })

  // Flow successful images into the existing creatives pipeline grid.
  if (outputRows.length > 0) {
    const { error: outErr } = await supabase.from('creative_strategy_outputs').insert(outputRows)
    if (outErr && !isMissingTableError(outErr)) {
      console.error('[generate-statics] could not record pipeline rows:', outErr.message)
    }
  }

  const status: 'done' | 'failed' = generated > 0 ? 'done' : 'failed'
  const batchError = failed > 0
    ? `${failed} of ${count} image${count === 1 ? '' : 's'} failed. ${firstError}`.trim()
    : null

  await supabase
    .from('creative_generations')
    .update({ status, results, error: batchError })
    .eq('id', gen.id)

  if (generated > 0) {
    notifyCreativesGenerated(client.name, generated, failed, 'quick')
  }

  if (generated === 0) {
    const actionable = settled.find((r) => r.status === 'rejected' && r.reason instanceof StaticGenError)
    const message = actionable && actionable.status === 'rejected'
      ? (actionable.reason as Error).message
      : `Generation failed for all images. ${firstError}`.trim()
    return NextResponse.json(
      { generation_id: gen.id, status, generated, failed, results, error: message },
      { status: 502 },
    )
  }

  return NextResponse.json({
    generation_id: gen.id,
    status,
    generated,
    failed,
    results,
    error: batchError,
  })
}
