import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = [
  'found', 'off_scope', 'no_bid', 'no_contact_email',
  'pushed_to_instantly', 'replied', 'meeting', 'bid_drafted',
  'submitted', 'won', 'lost',
] as const

type Status = typeof VALID_STATUSES[number]

export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const status = new URL(req.url).searchParams.get('status')

  let query = supabase.from('gov_tenders').select('*').order('contract_end', { ascending: true, nullsFirst: false })
  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tenders: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  let body: { notice_id: string; status: Status; notes?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.notice_id || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'notice_id and valid status required' }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    status: body.status,
    last_update: new Date().toISOString().slice(0, 10),
  }
  if (body.notes !== undefined) update.notes = body.notes

  const { error } = await supabase.from('gov_tenders').update(update).eq('notice_id', body.notice_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
