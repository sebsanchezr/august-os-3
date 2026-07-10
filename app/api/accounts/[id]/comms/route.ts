import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyClientFlag } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

const VALID_DIRECTIONS = ['inbound', 'outbound'] as const
const VALID_CHANNELS = ['whatsapp', 'email', 'call', 'meeting'] as const
const VALID_SENTIMENTS = ['positive', 'neutral', 'concern'] as const

// Default SLA hours by channel (WA=2h, email=24h, call and meeting don't need a response clock)
const DEFAULT_SLA_HOURS: Record<string, number | null> = {
  whatsapp: 2,
  email: 24,
  call: null,
  meeting: null,
}

function computeResponseDue(
  channel: string,
  occurredAt: string,
  slaOverride: Record<string, number> | null,
): string | null {
  const key = `${channel}_hours`
  const hours = slaOverride?.[key] ?? DEFAULT_SLA_HOURS[channel] ?? null
  if (hours === null) return null
  const due = new Date(occurredAt)
  due.setHours(due.getHours() + hours)
  return due.toISOString()
}

// POST /api/accounts/[id]/comms
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const direction = (body.direction as string) || 'outbound'
  const channel = (body.channel as string) || 'whatsapp'
  const sentiment = (body.sentiment as string) || 'neutral'

  if (!body.summary || typeof body.summary !== 'string') {
    return NextResponse.json({ error: 'summary is required' }, { status: 400 })
  }
  if (!(VALID_DIRECTIONS as readonly string[]).includes(direction)) {
    return NextResponse.json({ error: `direction must be one of: ${VALID_DIRECTIONS.join(', ')}` }, { status: 400 })
  }
  if (!(VALID_CHANNELS as readonly string[]).includes(channel)) {
    return NextResponse.json({ error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` }, { status: 400 })
  }
  if (!(VALID_SENTIMENTS as readonly string[]).includes(sentiment)) {
    return NextResponse.json({ error: `sentiment must be one of: ${VALID_SENTIMENTS.join(', ')}` }, { status: 400 })
  }

  const flags = Array.isArray(body.flags) ? (body.flags as string[]) : []
  const occurredAt = (body.occurred_at as string) || new Date().toISOString()
  const requiresResponse = direction === 'inbound' && (body.requires_response as boolean) !== false

  // Fetch client SLA overrides
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, health, comms_sla')
    .eq('id', id)
    .single()

  const responseDueAt = requiresResponse
    ? computeResponseDue(channel, occurredAt, (client?.comms_sla as Record<string, number> | null) ?? null)
    : null

  const { data: log, error: logErr } = await supabase
    .from('client_comms_log')
    .insert({
      client_id:         id,
      direction,
      channel,
      summary:           (body.summary as string).trim(),
      sentiment,
      flags,
      logged_by:         body.logged_by ?? null,
      occurred_at:       occurredAt,
      requires_response: requiresResponse,
      response_due_at:   responseDueAt,
      responded_at:      null,
      sla_breached:      false,
    })
    .select()
    .single()

  if (logErr || !log) return NextResponse.json({ error: logErr?.message ?? 'Insert failed' }, { status: 500 })

  // Update last_client_contact
  await supabase
    .from('clients')
    .update({ last_client_contact: occurredAt, updated_at: new Date().toISOString() })
    .eq('id', id)

  // If outbound, resolve the oldest open inbound clock for this client
  if (direction === 'outbound') {
    const { data: openInbound } = await supabase
      .from('client_comms_log')
      .select('id')
      .eq('client_id', id)
      .eq('requires_response', true)
      .is('responded_at', null)
      .order('occurred_at', { ascending: true })
      .limit(1)
    if (openInbound && openInbound.length > 0) {
      await supabase
        .from('client_comms_log')
        .update({ responded_at: new Date().toISOString() })
        .eq('id', openInbound[0].id)
    }
  }

  // Flag Discord warning
  if (flags.length > 0 && client) {
    notifyClientFlag(client, flags)
  }

  return NextResponse.json({ comm: log }, { status: 201 })
}

// GET /api/accounts/[id]/comms
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { data, error } = await supabase
    .from('client_comms_log')
    .select('*, logger:profiles!client_comms_log_logged_by_fkey(id, name)')
    .eq('client_id', id)
    .order('occurred_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comms: data ?? [] })
}
