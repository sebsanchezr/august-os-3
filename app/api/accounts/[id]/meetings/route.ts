import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyMeetingPrepReady } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['weekly', 'monthly', 'adhoc'] as const
const VALID_STATUSES = ['scheduled', 'done', 'cancelled'] as const
const VALID_RECURRENCES = ['weekly', 'monthly'] as const

// GET /api/accounts/[id]/meetings
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { data, error } = await supabase
    .from('client_meetings')
    .select('*, prep_report:client_reports!client_meetings_prep_report_id_fkey(id, status), followup_report:client_reports!client_meetings_followup_report_id_fkey(id, status)')
    .eq('client_id', id)
    .order('scheduled_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meetings: data ?? [] })
}

// POST /api/accounts/[id]/meetings
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.scheduled_at) {
    return NextResponse.json({ error: 'scheduled_at is required' }, { status: 400 })
  }

  const type = (body.type as string) || 'weekly'
  if (!(VALID_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 })
  }

  const recurrence = body.recurrence as string | undefined
  if (recurrence && !(VALID_RECURRENCES as readonly string[]).includes(recurrence)) {
    return NextResponse.json({ error: `recurrence must be one of: ${VALID_RECURRENCES.join(', ')}` }, { status: 400 })
  }

  const { data: meeting, error } = await supabase
    .from('client_meetings')
    .insert({
      client_id:        id,
      type,
      scheduled_at:     body.scheduled_at,
      agenda:           body.agenda ?? null,
      duration_minutes: body.duration_minutes ?? 30,
      attendees:        body.attendees ?? [],
      recurrence:       recurrence ?? null,
    })
    .select()
    .single()

  if (error || !meeting) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  return NextResponse.json({ meeting }, { status: 201 })
}

// PATCH /api/accounts/[id]/meetings
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.meeting_id) return NextResponse.json({ error: 'meeting_id is required' }, { status: 400 })

  const allowed = [
    'status', 'agenda', 'transcript_id', 'prep_report_id', 'followup_report_id',
    'minutes_md', 'minutes_sent_at', 'prep_ready_at', 'outcome_note',
    'duration_minutes', 'attendees', 'recurrence',
  ]
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (body.status && !(VALID_STATUSES as readonly string[]).includes(body.status as string)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  // Fetch current meeting before update so we can handle recurrence
  const { data: existing } = await supabase
    .from('client_meetings')
    .select('*, clients(id, name, am_profile_id)')
    .eq('id', body.meeting_id as string)
    .eq('client_id', id)
    .single()

  const { data: meeting, error } = await supabase
    .from('client_meetings')
    .update(patch)
    .eq('id', body.meeting_id as string)
    .eq('client_id', id)
    .select()
    .single()

  if (error || !meeting) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })

  // On prep_ready_at being set, fire Discord notification
  if ('prep_ready_at' in body && body.prep_ready_at && existing?.clients) {
    const { data: am } = existing.clients.am_profile_id
      ? await supabase.from('profiles').select('name, discord_user_id').eq('id', existing.clients.am_profile_id).single()
      : { data: null }
    notifyMeetingPrepReady(meeting, existing.clients, am)
  }

  // On status -> done: clone if recurrence set
  if (body.status === 'done' && existing?.recurrence) {
    const nextDate = computeNextDate(existing.scheduled_at, existing.recurrence)
    await supabase.from('client_meetings').insert({
      client_id:        id,
      type:             existing.type,
      scheduled_at:     nextDate,
      agenda:           null,
      duration_minutes: existing.duration_minutes,
      attendees:        existing.attendees ?? [],
      recurrence:       existing.recurrence,
      status:           'scheduled',
    })
  }

  return NextResponse.json({ meeting })
}

function computeNextDate(from: string, recurrence: string): string {
  const d = new Date(from)
  if (recurrence === 'weekly') d.setDate(d.getDate() + 7)
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1)
  return d.toISOString()
}
