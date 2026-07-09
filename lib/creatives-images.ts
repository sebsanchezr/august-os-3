// Server-only: static ad image generation for the Creative engine.
// Imported by API routes only; never import from client components.
//
// Generation path (first that works wins):
//   1. Gemini image API (nano banana) via the REST endpoint. Requires
//      GEMINI_API_KEY on a project with image-generation quota (billing
//      enabled). Free-tier keys return HTTP 429 with limit 0 and are skipped.
//   2. OpenAI gpt-image-1 fallback. Requires OPENAI_API_KEY.
// If neither path can produce an image we throw ImageGenError with an
// actionable message so the route never leaves a strategy stuck 'generating'.
//
// Uses fetch only (no new SDK deps).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { GenConcept } from './creatives'

export class ImageGenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageGenError'
  }
}

const BUCKET = 'creative-outputs'

// Newest nano banana flash image model first, then older, then pro. Overridable
// via GEMINI_IMAGE_MODEL. Model landscape churns, so we try the list in order.
function geminiModels(): string[] {
  const override = process.env.GEMINI_IMAGE_MODEL?.trim()
  const defaults = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image', 'gemini-3-pro-image']
  return override ? [override, ...defaults.filter(m => m !== override)] : defaults
}

type GeneratedImage = { buffer: Buffer; mime: string; provider: string; model: string }

// Map our aspect ratios to the closest gpt-image-1 size. 4:5 -> portrait.
function openaiSize(aspect: string): string {
  return aspect === '4:5' ? '1024x1536' : '1024x1024'
}

async function tryGemini(prompt: string, aspect: string): Promise<GeneratedImage | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null

  // Aspect ratio is guidance in the prompt; nano banana honours it in-scene.
  const fullPrompt = `${prompt}\n\nRender this as a ${aspect} aspect ratio static ad image.`

  let lastErr = ''
  for (const model of geminiModels()) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
        }
      )
      if (!res.ok) {
        lastErr = `${model}: HTTP ${res.status}`
        // 404 (model gone) or 429 (no quota): try the next model.
        continue
      }
      const json = await res.json()
      const parts = json?.candidates?.[0]?.content?.parts ?? []
      const imgPart = parts.find((p: Record<string, unknown>) => p.inlineData || p.inline_data)
      const data = (imgPart?.inlineData || imgPart?.inline_data) as { data?: string; mimeType?: string; mime_type?: string } | undefined
      if (!data?.data) { lastErr = `${model}: no image in response`; continue }
      return {
        buffer: Buffer.from(data.data, 'base64'),
        mime: data.mimeType || data.mime_type || 'image/png',
        provider: 'gemini',
        model,
      }
    } catch (err) {
      lastErr = `${model}: ${(err as Error).message}`
    }
  }
  if (lastErr) console.warn('[creatives-images] gemini path failed:', lastErr)
  return null
}

async function tryOpenAI(prompt: string, aspect: string): Promise<GeneratedImage | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: openaiSize(aspect), n: 1 }),
    })
    if (!res.ok) {
      console.warn('[creatives-images] openai path failed:', `HTTP ${res.status}`, (await res.text()).slice(0, 200))
      return null
    }
    const json = await res.json()
    const b64 = json?.data?.[0]?.b64_json
    if (!b64) return null
    return { buffer: Buffer.from(b64, 'base64'), mime: 'image/png', provider: 'openai', model: 'gpt-image-1' }
  } catch (err) {
    console.warn('[creatives-images] openai path error:', (err as Error).message)
    return null
  }
}

// Generate one image. Throws ImageGenError if no provider can produce one.
export async function generateImage(prompt: string, aspect: string): Promise<GeneratedImage> {
  const viaGemini = await tryGemini(prompt, aspect)
  if (viaGemini) return viaGemini

  const viaOpenAI = await tryOpenAI(prompt, aspect)
  if (viaOpenAI) return viaOpenAI

  const hasGemini = !!process.env.GEMINI_API_KEY
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  if (!hasGemini && !hasOpenAI) {
    throw new ImageGenError('No image generation key set. Add OPENAI_API_KEY, or a billing-enabled GEMINI_API_KEY, to the OS environment.')
  }
  throw new ImageGenError(
    'Image generation unavailable. The GEMINI_API_KEY project has no image quota (enable billing at console.cloud.google.com, or get a fresh key at aistudio.google.com/apikey), and no working OPENAI_API_KEY fallback is set.'
  )
}

// Build the full image prompt from a concept plus brand context. Keeps any
// in-image copy short per the nano banana ~25 char legibility limit.
export function buildImagePrompt(concept: GenConcept, brand: { name: string; notes: string | null; assets: string[] }): string {
  const brandLine = brand.notes ? `Brand notes: ${brand.notes}.` : ''
  const assetLine = brand.assets.length ? `Brand references on file: ${brand.assets.join('; ')}.` : ''
  const hook = concept.hook?.trim()
  const hookLine = hook
    ? `Include short, legible in-image copy reading exactly "${hook.slice(0, 25)}". Keep the text crisp and correctly spelled.`
    : 'No text overlay needed.'
  return [
    `High quality, native-feeling static ad creative for ${brand.name}, a paid social ad. Never looks like AI slop.`,
    `Concept: ${concept.title}.`,
    `Visual direction: ${concept.visual_direction}.`,
    hookLine,
    brandLine,
    assetLine,
    'Photographic, sharp focus, professional lighting, no watermarks, no gibberish text, no distorted anatomy.',
  ].filter(Boolean).join(' ')
}

// Ensure the public bucket exists (idempotent), upload the bytes, return the
// public URL. Uses the service-key client so RLS is bypassed.
export async function uploadImage(
  supabase: SupabaseClient,
  buffer: Buffer,
  mime: string,
  path: string
): Promise<{ publicUrl: string; storagePath: string }> {
  // Create-if-missing: harmless when the migration already made the bucket.
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true })
  }

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: true,
  })
  if (error) throw new ImageGenError(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { publicUrl: data.publicUrl, storagePath: path }
}
