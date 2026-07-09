import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Postgres raises 42P01 (undefined_table) when migration 034 hasn't run yet.
const MISSING_TABLE_CODE = '42P01'

const WEBHOOK_URL = process.env.DISCORD_WEBDEV_WEBHOOK_URL || process.env.DISCORD_TASKS_WEBHOOK_URL || ''

type Embed = {
  title: string
  color: number
  description?: string
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string }
  timestamp?: string
}

async function postDiscord(content: string, embeds: Embed[]): Promise<void> {
  if (!WEBHOOK_URL) return
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, embeds }),
    })
  } catch {
    // fire-and-forget: never throw
  }
}

export async function GET() {
  try {
    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('website_builds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      if (error.code === MISSING_TABLE_CODE) {
        return NextResponse.json({ error: 'Run migration 034 (website_builds table missing)' }, { status: 500 })
      }
      throw error
    }

    return NextResponse.json({ builds: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[websites GET]', err)
    return NextResponse.json({ error: 'Failed to fetch website builds' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { business_name, google_url, phone, city, niche, notes } = body
    let requested_by: string | null = body.requested_by || null

    if (!business_name || !String(business_name).trim()) {
      return NextResponse.json({ error: 'business_name is required' }, { status: 400 })
    }

    if (!requested_by) {
      try {
        const supabaseUser = createSupabaseServer()
        const { data: { user } } = await supabaseUser.auth.getUser()
        requested_by = user?.email ?? null
      } catch {
        requested_by = null
      }
    }

    const supabase = createSupabaseAdmin()
    const record = {
      business_name: String(business_name).trim(),
      google_url: google_url?.trim() || null,
      phone: phone?.trim() || null,
      city: city?.trim() || null,
      niche: niche?.trim() || 'roofing',
      notes: notes?.trim() || null,
      requested_by,
      status: 'requested' as const,
    }

    const { data, error } = await supabase
      .from('website_builds')
      .insert(record)
      .select()
      .single()

    if (error) {
      if (error.code === MISSING_TABLE_CODE) {
        return NextResponse.json({ error: 'Run migration 034 (website_builds table missing)' }, { status: 500 })
      }
      throw error
    }

    const fields = [
      ...(data.google_url ? [{ name: 'Google/Website URL', value: data.google_url, inline: false }] : []),
      ...(data.notes ? [{ name: 'Notes', value: data.notes, inline: false }] : []),
    ]
    void postDiscord(
      `Website build requested: ${data.business_name} (${data.city ?? 'unknown city'}, ${data.niche}) by ${requested_by ?? 'unknown'}`,
      [{
        title: `Website build requested: ${data.business_name}`,
        color: 0x6366F1,
        fields,
        footer: { text: 'August OS Websites' },
        timestamp: new Date().toISOString(),
      }],
    )

    return NextResponse.json({ build: data }, { status: 201 })
  } catch (err) {
    console.error('[websites POST]', err)
    return NextResponse.json({ error: 'Failed to create website build request' }, { status: 500 })
  }
}
