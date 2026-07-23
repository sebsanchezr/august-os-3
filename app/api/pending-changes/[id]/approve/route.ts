import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyIssueRaised } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// POST /api/pending-changes/[id]/approve
// Body: { approved_by?: uuid, payload?: object (edited inline before approving) }
//
// Applies the staged change into the live tables, then marks the row approved.
//   issue        -> insert into client_issues (open) + Discord issue notify
//   health       -> update clients.health
//   weekly_focus -> update clients.weekly_focus
// (Tasks are handled separately by pending_meeting_tasks / /api/pending-tasks.)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { body = {} }

  const { data: change, error: fetchErr } = await supabase
    .from('pending_changes')
    .select('*, clients(id, name, health)')
    .eq('id', id)
    .single()

  if (fetchErr || !change) return NextResponse.json({ error: 'Change not found' }, { status: 404 })
  if (change.status !== 'pending') {
    return NextResponse.json({ error: `Change is already ${change.status}` }, { status: 422 })
  }

  const client = Array.isArray(change.clients) ? change.clients[0] : change.clients
  if (!client) return NextResponse.json({ error: 'Change has no client' }, { status: 422 })

  // Allow inline edits to the payload before approving.
  const payload = (body.payload && typeof body.payload === 'object')
    ? { ...change.payload, ...(body.payload as Record<string, unknown>) }
    : change.payload

  let appliedRef: string | null = null

  try {
    if (change.kind === 'issue') {
      const { data, error } = await supabase
        .from('client_issues')
        .insert({
          client_id: client.id,
          category: payload.category,
          severity: payload.severity ?? 'minor',
          description: payload.description ?? '',
          root_cause: payload.root_cause || null,
          status: 'open',
        })
        .select('id, category, severity, description')
        .single()
      if (error) throw new Error(error.message)
      appliedRef = data.id
      notifyIssueRaised(
        { id: data.id, category: data.category, severity: data.severity, description: data.description },
        { id: client.id, name: client.name, health: client.health },
      )
    } else if (change.kind === 'health') {
      const to = String(payload.to ?? '')
      if (!['green', 'amber', 'red'].includes(to)) {
        return NextResponse.json({ error: `Invalid health value: ${to}` }, { status: 422 })
      }
      const { error } = await supabase.from('clients').update({ health: to }).eq('id', client.id)
      if (error) throw new Error(error.message)
    } else if (change.kind === 'weekly_focus') {
      const { error } = await supabase
        .from('clients')
        .update({ weekly_focus: String(payload.text ?? '') })
        .eq('id', client.id)
      if (error) throw new Error(error.message)
    } else {
      return NextResponse.json({ error: `Unknown change kind: ${change.kind}` }, { status: 422 })
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: `Failed to apply change: ${(e as Error).message}` }, { status: 500 })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('pending_changes')
    .update({
      status: 'approved',
      payload,
      applied_ref: appliedRef,
      approved_by: body.approved_by ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateErr || !updated) {
    return NextResponse.json({ error: updateErr?.message ?? 'Applied but failed to mark approved' }, { status: 500 })
  }

  return NextResponse.json({ change: updated })
}
