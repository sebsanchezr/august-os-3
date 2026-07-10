// Server-only: "Generate Statics" engine for the Creative Hub.
// Imported by API routes only; never import from client components.
//
// Uses the nano banana image API (Google Gemini, model gemini-2.5-flash-image)
// via the REST generateContent endpoint with responseModalities including IMAGE.
// The response carries base64 inlineData parts which we upload to the public
// 'creatives' storage bucket. fetch only, no new SDK deps.

import type { SupabaseClient } from '@supabase/supabase-js'

export class StaticGenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StaticGenError'
  }
}

const BUCKET = 'creatives'
const MODEL = process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image'

export type GeneratedStatic = { buffer: Buffer; mime: string }

// A single note source scanned for a no-AI-imagery brand rule.
export type NoteSource = { label: string; text: string | null | undefined }

// Phrases that signal an explicit no-AI directive.
const NO_AI_PATTERNS: RegExp[] = [
  /\bno[\s-]*ai\b/i,
  /\bnot?\s+ai\s+imagery\b/i,
  /\bavoid\s+ai\b/i,
  /\bnever\s+use\s+ai\b/i,
  /\breal\s+product\s+photography\s+only\b/i,
  /\breal\s+photography\s+only\b/i,
  /\bno\s+artificial\s+imagery\b/i,
]

// Cues that a sentence is NOT imposing a ban on THIS client: either it says AI
// is allowed, or it references another brand's rule by contrast. Without this,
// a note like "the opposite of L'alingi's no-AI rule" (which means AI IS
// allowed) would wrongly trigger a refusal.
const ALLOW_CUES = /\b(allowed|permitted|is fine|are fine|ok to use|okay to use|encouraged|welcome|opposite|unlike|whereas|can use ai|ai is fine|ai statics allowed|ai imagery is allowed|ai imagery allowed)\b/i

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// Detect a "no AI imagery" brand rule in any of the supplied note sources.
// Returns the first genuinely banning sentence, or null. Works sentence by
// sentence so an allow / contrast cue in the same sentence suppresses a false
// positive (this is a hard client rule, e.g. L'alingi, so precision matters).
export function detectNoAiRule(sources: NoteSource[]): { source: string; rule: string } | null {
  for (const s of sources) {
    const text = (s.text ?? '').trim()
    if (!text) continue
    for (const sentence of splitSentences(text)) {
      if (ALLOW_CUES.test(sentence)) continue
      if (NO_AI_PATTERNS.some((re) => re.test(sentence))) {
        return { source: s.label, rule: sentence.replace(/\s+/g, ' ').slice(0, 200) }
      }
    }
  }
  return null
}

export type PromptContext = {
  clientName: string
  clientNotes: string | null
  businessOverview: string | null
  targetAudience: string | null
  onboardingExtra: string | null
  assetNotes: string[]
  brief: string
  angle: string
}

// Assemble a grounded static-ad prompt from the client's DB context plus the
// media buyer's brief and angle. Kept native-feeling (no AI slop) and keeps any
// in-image copy short for legibility.
export function buildGroundedPrompt(ctx: PromptContext, variation: number, total: number): string {
  const lines: string[] = [
    `High quality, native-feeling static ad creative for ${ctx.clientName}, a paid social ad. It must never look like AI slop.`,
  ]
  if (ctx.brief) lines.push(`Brief: ${ctx.brief}.`)
  if (ctx.angle) lines.push(`Angle: ${ctx.angle}.`)
  if (ctx.businessOverview) lines.push(`Business: ${ctx.businessOverview.slice(0, 400)}.`)
  if (ctx.targetAudience) lines.push(`Target audience: ${ctx.targetAudience.slice(0, 300)}.`)
  if (ctx.clientNotes) lines.push(`Brand notes: ${ctx.clientNotes.slice(0, 400)}.`)
  if (ctx.onboardingExtra) lines.push(`Extra context: ${ctx.onboardingExtra.slice(0, 300)}.`)
  if (ctx.assetNotes.length) lines.push(`Brand references on file: ${ctx.assetNotes.slice(0, 8).join('; ').slice(0, 400)}.`)
  if (total > 1) lines.push(`This is variation ${variation} of ${total}: use a distinct composition and angle from the others.`)
  lines.push('Any in-image text must be short (under 25 characters), crisp and correctly spelled.')
  lines.push('Photographic, sharp focus, professional lighting, no watermarks, no gibberish text, no distorted anatomy.')
  return lines.filter(Boolean).join(' ')
}

// Generate one static image. Throws StaticGenError with an actionable message
// when the Gemini image path cannot produce an image (no key, no quota, etc).
export async function generateStatic(prompt: string): Promise<GeneratedStatic> {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    throw new StaticGenError('No GEMINI_API_KEY set. Add a billing-enabled Gemini key to generate statics.')
  }

  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      }
    )
  } catch (err) {
    throw new StaticGenError(`Gemini request failed: ${(err as Error).message}`)
  }

  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 300)
    // 429 with a free-tier key means image quota is 0; surface it plainly.
    throw new StaticGenError(`Gemini image API returned HTTP ${res.status}. ${body}`.trim())
  }

  const json = await res.json()
  const parts = json?.candidates?.[0]?.content?.parts ?? []
  const imgPart = parts.find((p: Record<string, unknown>) => p.inlineData || p.inline_data)
  const data = (imgPart?.inlineData || imgPart?.inline_data) as
    | { data?: string; mimeType?: string; mime_type?: string }
    | undefined
  if (!data?.data) {
    throw new StaticGenError('Gemini returned no image data in the response.')
  }
  return {
    buffer: Buffer.from(data.data, 'base64'),
    mime: data.mimeType || data.mime_type || 'image/png',
  }
}

// Ensure the public 'creatives' bucket exists (idempotent), upload the bytes,
// return the public URL. Uses the service-key client so RLS is bypassed.
export async function uploadStatic(
  supabase: SupabaseClient,
  buffer: Buffer,
  mime: string,
  path: string
): Promise<{ publicUrl: string; storagePath: string }> {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true })
  }

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: true,
  })
  if (error) throw new StaticGenError(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { publicUrl: data.publicUrl, storagePath: path }
}
