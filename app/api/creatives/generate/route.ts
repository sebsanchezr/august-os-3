import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { isMissingTableError, MIGRATION_MISSING_MESSAGE } from '@/lib/creatives'

// POST /api/creatives/generate: kick off static generation for an approved
// strategy. Env-gated: no nano banana / Gemini key exists yet, so this only
// queues the intent and marks the strategy as generating.
// Body: { strategy_id }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const strategy_id = body.strategy_id as string
  if (!strategy_id) return NextResponse.json({ error: 'strategy_id is required' }, { status: 400 })

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ skipped: true, reason: 'GEMINI_API_KEY not set' })
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('creative_strategies')
    .update({ status: 'generating' })
    .eq('id', strategy_id)
    .select('*')
    .single()

  if (error || !data) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: MIGRATION_MISSING_MESSAGE }, { status: 409 })
    }
    return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  }

  // TODO: nano banana (Gemini image generation) integration.
  // Once GEMINI_API_KEY is provisioned, this handler should:
  //   1. Parse the approved strategy_md into its 3 concepts (hook/angle/visual
  //      direction), likely via a small Claude call that returns structured
  //      JSON rather than re-parsing markdown by hand.
  //   2. For each concept, call the Gemini image generation endpoint
  //      (model family sometimes referred to as "nano banana") with a prompt
  //      built from the visual direction, the client's brand assets (pull
  //      from client_creative_assets where kind = 'brief' / 'asset'), and any
  //      house style guidance.
  //   3. Upload the resulting images to storage (Supabase storage bucket or
  //      Drive) and record their URLs, e.g. a new creative_strategy_outputs
  //      table (client_id, strategy_id, concept_index, image_url).
  //   4. Once all concepts have generated images, set the strategy status to
  //      'delivered' and notify the owner (Discord, matching other crons).
  // None of this is implemented yet. This route currently only flips the
  // strategy to 'generating' so the UI reflects that generation was queued.

  return NextResponse.json({ queued: true })
}
