import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase-server'
import { buildAndDeploySite } from '@/lib/site-builder'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
    const {
      business_name, google_url, phone, city, niche, notes,
      owner_name, email, service_area, services, existing_site_url, requested_by_discord,
    } = body
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
    const cleanServices = Array.isArray(services)
      ? services.map((s: unknown) => String(s).trim()).filter(Boolean)
      : null

    const record = {
      business_name: String(business_name).trim(),
      google_url: google_url?.trim() || null,
      phone: phone?.trim() || null,
      city: city?.trim() || null,
      niche: niche?.trim() || 'roofing',
      notes: notes?.trim() || null,
      owner_name: owner_name?.trim() || null,
      email: email?.trim() || null,
      service_area: service_area?.trim() || null,
      services: cleanServices && cleanServices.length ? cleanServices : null,
      existing_site_url: existing_site_url?.trim() || null,
      requested_by_discord: requested_by_discord?.trim() || null,
      requested_by,
      status: 'building' as const,
    }

    const { data: inserted, error } = await supabase
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

    // Build starts immediately, no manual "approve to start" step. Runs inline
    // so the response only returns once the site is live (or has failed) and
    // the caller has a link ready to open before the call.
    const result = await buildAndDeploySite({
      businessName: inserted.business_name,
      niche: inserted.niche,
      city: inserted.city,
      serviceArea: inserted.service_area,
      phone: inserted.phone,
      services: inserted.services ?? [],
      ownerName: inserted.owner_name,
      notes: inserted.notes,
      googleUrl: inserted.google_url,
      existingSiteUrl: inserted.existing_site_url,
    })

    const { data, error: updateErr } = await supabase
      .from('website_builds')
      .update({
        status: 'built',
        site_url: result.siteUrl,
        logo_url: result.logoUrl,
        brief_summary: result.design.sales_brief.summary,
        brief_talking_points: result.design.sales_brief.talking_points,
        brief_objection_prep: result.design.sales_brief.objection_prep,
        build_error: result.deployError,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inserted.id)
      .select()
      .single()

    const finalRecord = updateErr ? inserted : data

    const brief = result.design.sales_brief
    const fields = [
      ...(finalRecord.site_url ? [{ name: 'Demo site', value: finalRecord.site_url, inline: false }] : []),
      { name: 'Sales brief', value: brief.summary, inline: false },
      ...(brief.talking_points.length ? [{ name: 'Talking points', value: brief.talking_points.map((t: string) => `- ${t}`).join('\n'), inline: false }] : []),
      ...(brief.objection_prep.length ? [{ name: 'Objection prep', value: brief.objection_prep.map((t: string) => `- ${t}`).join('\n'), inline: false }] : []),
      ...(!result.deployed ? [{ name: 'Deploy status', value: result.deployError || 'Site did not deploy, check logs', inline: false }] : []),
    ]
    void postDiscord(
      result.deployed
        ? `Website ready: ${finalRecord.business_name} (${finalRecord.city ?? 'unknown city'}, ${finalRecord.niche}), requested by ${requested_by ?? 'unknown'}`
        : `Website build had issues: ${finalRecord.business_name}, requested by ${requested_by ?? 'unknown'} (brief still below)`,
      [{
        title: result.deployed ? `Ready for the call: ${finalRecord.business_name}` : `Build issue: ${finalRecord.business_name}`,
        color: result.deployed ? 0x22C55E : 0xF59E0B,
        fields,
        footer: { text: 'August OS Websites' },
        timestamp: new Date().toISOString(),
      }],
    )

    return NextResponse.json({ build: finalRecord }, { status: 201 })
  } catch (err) {
    console.error('[websites POST]', err)
    return NextResponse.json({ error: 'Failed to create website build request' }, { status: 500 })
  }
}
