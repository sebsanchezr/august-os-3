import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyMeetingCancelled } from '@/lib/discord-notify'

// PATCH /api/meetings/[id]
// Cross-client meeting hub endpoint (no client_id required in the URL, unlike
// /api/accounts/[id]/meetings). Currently only supports the cancellation
// transition: { status: 'cancelled', cancellation_reason?: string }.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (body.status !== 'cancelled') {
    return NextResponse.json(
      { error: "Only { status: 'cancelled' } is supported on this endpoint" },
      { status: 400 },
    )
  }

  const cancellationReason = typeof body.cancellation_reason === 'string'
    ? body.cancellation_reason.trim() || null
    : null

  const { data: existing, error: fetchErr } = await supabase
    .from('client_meetings')
    .select('*, clients(id, name, health, am_profile_id)')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  if (existing.status !== 'scheduled') {
    return NextResponse.json(
      { error: `Cannot cancel a meeting with status '${existing.status}'. Only scheduled meetings can be cancelled.` },
      { status: 422 },
    )
  }

  const now = new Date().toISOString()

  const { data: meeting, error } = await supabase
    .from('client_meetings')
    .update({
      status: 'cancelled',
      cancellation_reason: cancellationReason,
      updated_at: now,
    })
    .eq('id', id)
    .select()
    .single()

  if (error || !meeting) {
    return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  }

  if (existing.clients) {
    notifyMeetingCancelled(meeting, existing.clients, cancellationReason)
  }

  return NextResponse.json({ meeting })
}
