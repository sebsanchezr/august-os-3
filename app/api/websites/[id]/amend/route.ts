import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase-server'
import { buildAndDeploySite, type SiteDesign, type BusinessResearch } from '@/lib/site-builder'

export const dynamic = 'force-dynamic'
export const maxDuration = 280

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

// Send an existing build back for a revision instead of a flat reject: the
// caller/Seb types what to change, the site + brief get regenerated off the
// prior version (not from scratch), and everyone can see which numbered
// version is live so "which link did I send them" is never ambiguous.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  try {
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
    if (!notes) return NextResponse.json({ error: 'Amend notes are required' }, { status: 400 })

    const supabase = createSupabaseAdmin()
    const { data: current, error: fetchErr } = await supabase
      .from('website_builds')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr) {
      if (fetchErr.code === MISSING_TABLE_CODE) {
        return NextResponse.json({ error: 'Run migrations (website_builds table missing)' }, { status: 500 })
      }
      return NextResponse.json({ error: 'Website build not found' }, { status: 404 })
    }
    if (!current) return NextResponse.json({ error: 'Website build not found' }, { status: 404 })
    if (!current.site_design) {
      return NextResponse.json({ error: 'No prior design to amend, this build has no site_design saved' }, { status: 400 })
    }

    let amendedBy: string | null = typeof body.amended_by === 'string' ? body.amended_by : null
    if (!amendedBy) {
      try {
        const supabaseUser = createSupabaseServer()
        const { data: { user } } = await supabaseUser.auth.getUser()
        amendedBy = user?.email ?? null
      } catch {
        amendedBy = null
      }
    }

    const nextRevision = (current.revision ?? 1) + 1
    // Pre-v2 rows (like the original Peak Roofer build) have no research_data
    // saved. Amending one re-runs real research (Apify) as part of upgrading
    // it, rather than reusing whatever the old pipeline produced (nothing).
    const isUpgradeFromV1 = !current.research_data

    const result = await buildAndDeploySite({
      businessName: current.business_name,
      niche: current.niche,
      city: current.city,
      serviceArea: current.service_area,
      phone: current.phone,
      services: current.services ?? [],
      ownerName: current.owner_name,
      notes: current.notes,
      googleUrl: current.google_url,
      existingSiteUrl: current.existing_site_url,
      buildId: current.id,
      amend: {
        notes,
        previousDesign: current.site_design as SiteDesign,
        previousResearch: (current.research_data as BusinessResearch | null) ?? null,
      },
    })

    const historyEntry = {
      revision: nextRevision,
      notes: isUpgradeFromV1 ? `${notes} (upgraded to v2 engine: real research + photos)` : notes,
      requested_by: amendedBy ?? 'unknown',
      requested_at: new Date().toISOString(),
    }
    const nextHistory = Array.isArray(current.amend_history) ? [...current.amend_history, historyEntry] : [historyEntry]

    const r = result.research
    const { data, error: updateErr } = await supabase
      .from('website_builds')
      .update({
        status: 'built',
        site_url: result.siteUrl,
        logo_url: r.logo_url,
        site_design: result.design,
        research_data: r,
        phone: current.phone || r.phone,
        city: current.city || r.city,
        brief_summary: result.design.sales_brief.summary,
        brief_talking_points: result.design.sales_brief.talking_points,
        brief_objection_prep: result.design.sales_brief.objection_prep,
        build_error: result.deployError,
        revision: nextRevision,
        amend_history: nextHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) throw updateErr

    void postDiscord(
      result.deployed
        ? `Website amended (v${nextRevision}): ${data.business_name}, requested by ${amendedBy ?? 'unknown'}`
        : `Website amend had issues (v${nextRevision}): ${data.business_name}, requested by ${amendedBy ?? 'unknown'}`,
      [{
        title: `${result.deployed ? 'Amended' : 'Amend issue'} v${nextRevision}: ${data.business_name}`,
        color: result.deployed ? 0x22C55E : 0xF59E0B,
        fields: [
          { name: 'Changes requested', value: notes, inline: false },
          ...(data.site_url ? [{ name: `Live link (v${nextRevision})`, value: data.site_url, inline: false }] : []),
          ...(r.phone ? [{ name: 'Real phone found', value: r.phone, inline: true }] : []),
          ...(r.rating != null ? [{ name: 'Google rating', value: `${r.rating} (${r.review_count ?? 0} reviews)`, inline: true }] : []),
          ...(!result.deployed ? [{ name: 'Deploy status', value: result.deployError || 'Site did not deploy, check logs', inline: false }] : []),
        ],
        footer: { text: 'August OS Websites' },
        timestamp: new Date().toISOString(),
      }],
    )

    return NextResponse.json({ build: data })
  } catch (err) {
    console.error('[websites amend POST]', err)
    return NextResponse.json({ error: 'Failed to amend website build' }, { status: 500 })
  }
}
