// Cheap research pass for the "request a website" pipeline: fetch whatever URL
// the caller gave us (Google Business listing or existing site), pull out a
// logo if there's an obvious one, and have Haiku extract the handful of facts
// a closer needs before a call. Non-fatal: any failure here just means the
// site/brief render without that context, never blocks the build.

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const HAIKU = 'claude-haiku-4-5-20251001'

export type BusinessResearch = {
  founded_year: string | null
  years_active: string | null
  location_detail: string | null
  notable_facts: string[]
  logo_url: string | null
}

const EMPTY: BusinessResearch = {
  founded_year: null,
  years_active: null,
  location_detail: null,
  notable_facts: [],
  logo_url: null,
}

function extractText(msg: Anthropic.Message): string {
  const block = msg.content.find(b => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractLogoUrl(html: string, baseUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["'](?:apple-touch-icon|icon)["'][^>]+href=["']([^"']+)["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) {
      try {
        return new URL(m[1], baseUrl).toString()
      } catch {
        continue
      }
    }
  }
  return null
}

async function fetchPage(url: string): Promise<{ text: string; html: string } | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AugustOSBot/1.0)' },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const html = await res.text()
    return { text: stripHtml(html).slice(0, 6000), html }
  } catch {
    return null
  }
}

export async function researchBusiness(
  businessName: string,
  urls: (string | null | undefined)[],
): Promise<BusinessResearch> {
  const targetUrl = urls.find(u => u && u.trim())
  if (!targetUrl) return EMPTY

  const page = await fetchPage(targetUrl.trim())
  if (!page || !page.text) return EMPTY

  const logo_url = extractLogoUrl(page.html, targetUrl.trim())

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...EMPTY, logo_url }
  }

  const prompt = `Read this scraped page text for the business "${businessName}" and extract what a salesperson needs to know before calling them. Return ONLY valid JSON, no markdown fences, in this exact shape:
{"founded_year": "e.g. 2011 or null", "years_active": "e.g. 13 years or null", "location_detail": "short phrase, area/neighbourhood/landmark if mentioned, else null", "notable_facts": ["up to 3 short factual bullet points a caller could reference, e.g. awards, specialisms, family-run, number of reviews"]}

If the page has nothing useful, return {"founded_year": null, "years_active": null, "location_detail": null, "notable_facts": []}. Never invent facts not present in the text.

PAGE TEXT:
${page.text}`

  try {
    const msg = await client.messages.create({
      model: HAIKU,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = extractText(msg).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(raw)
    return {
      founded_year: parsed.founded_year || null,
      years_active: parsed.years_active || null,
      location_detail: parsed.location_detail || null,
      notable_facts: Array.isArray(parsed.notable_facts) ? parsed.notable_facts.slice(0, 3).map(String) : [],
      logo_url,
    }
  } catch {
    return { ...EMPTY, logo_url }
  }
}
