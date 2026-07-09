import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

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

const VALID_STATUSES = ['requested', 'approved', 'building', 'built', 'site_approved', 'sent', 'rejected'] as const
type Status = typeof VALID_STATUSES[number]

const STATUS_COLOUR: Record<Status, number> = {
  requested: 0x636780,
  approved: 0x6366F1,
  building: 0xF59E0B,
  built: 0x10B981,
  site_approved: 0x10B981,
  sent: 0x22C55E,
  rejected: 0xEF4444,
}

const STATUS_LABEL: Record<Status, string> = {
  requested: 'Requested',
  approved: 'Approved',
  building: 'Building',
  built: 'Built',
  site_approved: 'Site approved',
  sent: 'Sent to caller',
  rejected: 'Rejected',
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  try {
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

    const supabase = createSupabaseAdmin()
    const { data: current, error: fetchErr } = await supabase
      .from('website_builds')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr) {
      if (fetchErr.code === MISSING_TABLE_CODE) {
        return NextResponse.json({ error: 'Run migration 034 (website_builds table missing)' }, { status: 500 })
      }
      return NextResponse.json({ error: 'Website build not found' }, { status: 404 })
    }
    if (!current) return NextResponse.json({ error: 'Website build not found' }, { status: 404 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.site_url === 'string') {
      updates.site_url = body.site_url.trim() || null
    }

    let newStatus: Status | null = null
    if (typeof body.status === 'string') {
      if (!(VALID_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
      }
      newStatus = body.status as Status
      updates.status = newStatus

      if (newStatus === 'rejected' && typeof body.reason === 'string' && body.reason.trim()) {
        const existingNotes = current.notes ? `${current.notes}\n\n` : ''
        updates.notes = `${existingNotes}Rejected: ${body.reason.trim()}`
      }
    }

    const { data, error } = await supabase
      .from('website_builds')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === MISSING_TABLE_CODE) {
        return NextResponse.json({ error: 'Run migration 034 (website_builds table missing)' }, { status: 500 })
      }
      throw error
    }

    if (newStatus && ['approved', 'built', 'site_approved'].includes(newStatus)) {
      void postDiscord(
        `Website build update: ${data.business_name} is now ${STATUS_LABEL[newStatus]}`,
        [{
          title: `${STATUS_LABEL[newStatus]}: ${data.business_name}`,
          color: STATUS_COLOUR[newStatus],
          fields: data.site_url ? [{ name: 'Site URL', value: data.site_url, inline: false }] : [],
          footer: { text: 'August OS Websites' },
          timestamp: new Date().toISOString(),
        }],
      )
    }

    return NextResponse.json({ build: data })
  } catch (err) {
    console.error('[websites PATCH]', err)
    return NextResponse.json({ error: 'Failed to update website build' }, { status: 500 })
  }
}
