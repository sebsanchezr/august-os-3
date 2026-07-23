import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyPendingChanges } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// POST /api/pending-changes/inbound
// Authenticated by X-Agent-Key (AGENT_INBOUND_KEY, same key as
// /api/pending-tasks/inbound). Used by agents/06_meeting_tasks/meeting_agent.py
// after extracting NON-task proposals from a matched client transcript:
// client issues, a health read, and a weekly-focus note.
//
// Body: a single object OR an array of:
//   {
//     kind: 'issue' | 'health' | 'weekly_focus',
//     client_id?: uuid,            // preferred
//     client_name?: string,        // resolved against clients.name / aliases
//     meeting_id?: uuid,
//     payload: object,             // shape depends on kind (see migration 053)
//     summary?: string,
//     quote?: string
//   }
//
// Writes status='pending' rows into pending_changes. Nothing touches the client
// profile until Seb approves via /api/pending-changes/[id]/approve.

const KINDS = new Set(['issue', 'health', 'weekly_focus'])

type InboundItem = {
  kind?: string
  client_id?: string | null
  client_name?: string | null
  meeting_id?: string | null
  payload?: Record<string, unknown>
  summary?: string | null
  quote?: string | null
}

export async function POST(req: NextRequest) {
  const agentKey = req.headers.get('x-agent-key')
  const expectedKey = process.env.AGENT_INBOUND_KEY
  if (!expectedKey) return NextResponse.json({ error: 'Inbound endpoint not configured' }, { status: 503 })
  if (!agentKey || agentKey !== expectedKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const items: InboundItem[] = Array.isArray(body) ? body as InboundItem[] : [body as InboundItem]
  if (items.length === 0) return NextResponse.json({ error: 'No items provided' }, { status: 400 })

  const supabase = createSupabaseAdmin()

  // Resolve any client_name -> id once (case-insensitive on name or aliases).
  const names = [...new Set(items.filter(i => !i.client_id && i.client_name).map(i => i.client_name as string))]
  const nameToId = new Map<string, { id: string; name: string; health: string }>()
  for (const name of names) {
    const { data } = await supabase
      .from('clients')
      .select('id, name, health, aliases')
      .or(`name.ilike.${name},aliases.cs.{${name}}`)
      .limit(1)
    if (data && data[0]) nameToId.set(name.toLowerCase(), { id: data[0].id, name: data[0].name, health: data[0].health })
  }

  const rows = []
  const skipped: string[] = []
  for (const item of items) {
    if (!item || !KINDS.has(item.kind ?? '')) {
      return NextResponse.json({ error: `Each item needs kind in ${[...KINDS].join('|')}` }, { status: 400 })
    }
    const resolved = item.client_id
      ? item.client_id
      : (item.client_name ? nameToId.get(item.client_name.toLowerCase())?.id : undefined)
    if (!resolved) {
      // issue/health/weekly_focus only make sense against a known client
      skipped.push(item.client_name ?? '(no client)')
      continue
    }
    rows.push({
      client_id: resolved,
      meeting_id: item.meeting_id || null,
      source: 'meeting',
      kind: item.kind,
      payload: item.payload ?? {},
      summary: (item.summary ?? '').slice(0, 500) || null,
      quote: item.quote || null,
      status: 'pending',
    })
  }

  let inserted: { client_id: string; kind: string }[] = []
  if (rows.length > 0) {
    const { data, error } = await supabase.from('pending_changes').insert(rows).select('client_id, kind')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    inserted = data ?? []
  }

  // One Discord ping per client summarising what's waiting.
  const byClient = new Map<string, { task: number; issue: number; health: number; weekly_focus: number }>()
  for (const r of inserted) {
    const counts = byClient.get(r.client_id) ?? { task: 0, issue: 0, health: 0, weekly_focus: 0 }
    if (r.kind in counts) counts[r.kind as keyof typeof counts]++
    byClient.set(r.client_id, counts)
  }
  for (const [clientId, counts] of byClient) {
    const { data: c } = await supabase.from('clients').select('id, name, health').eq('id', clientId).single()
    if (c) notifyPendingChanges({ id: c.id, name: c.name, health: c.health }, counts)
  }

  return NextResponse.json({ inserted: inserted.length, skipped }, { status: 201 })
}
