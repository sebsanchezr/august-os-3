import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Called cross-origin from a demo site's own throwaway Vercel domain (each
// build is deployed as a separate project, e.g. peak-roofer-xyz.vercel.app),
// so this has no Supabase session and must stay open, CORS-wide, unauthed.
// Low-risk write target: it only ever inserts a lead row and pings Discord.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const WEBHOOK_URL = process.env.DISCORD_WEBDEV_WEBHOOK_URL || process.env.DISCORD_TASKS_WEBHOOK_URL || ''

async function postDiscord(content: string): Promise<void> {
  if (!WEBHOOK_URL) return
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  } catch {
    // fire-and-forget: never throw
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : null
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 60) : null
    const postcode = typeof body.postcode === 'string' ? body.postcode.trim().slice(0, 20) : null
    const job_type = typeof body.job_type === 'string' ? body.job_type.trim().slice(0, 200) : null
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : null
    const build_id = typeof body.build_id === 'string' && body.build_id ? body.build_id : null

    if (!name && !phone) {
      return NextResponse.json({ error: 'name or phone required' }, { status: 400, headers: CORS_HEADERS })
    }

    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('website_leads')
      .insert({ build_id, name, phone, postcode, job_type, message })
      .select()
      .single()

    if (error) throw error

    let businessName = 'a demo site'
    if (build_id) {
      const { data: build } = await supabase.from('website_builds').select('business_name').eq('id', build_id).single()
      if (build?.business_name) businessName = build.business_name
    }

    void postDiscord(`New lead from demo site (${businessName}): ${name || 'no name'} · ${phone || 'no phone'}${job_type ? ` · ${job_type}` : ''}`)

    return NextResponse.json({ ok: true, lead: data }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[website-leads POST]', err)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500, headers: CORS_HEADERS })
  }
}
