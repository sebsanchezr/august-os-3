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
  const params = new URL(req.url).searchParams
  const status = params.get('status')
  const sort = params.get('sort')

  // Default sort keeps the old contract_end ordering. The Bid Manager's submit
  // queue asks for sort=deadline (soonest deadline first, nulls last). Both
  // deadline and contract_end are nullable — nullsFirst:false pushes blanks down.
  const wantDeadline = sort === 'deadline'
  const sortCol = wantDeadline ? 'deadline' : 'contract_end'

  const runQuery = (col: string) => {
    let q = supabase.from('gov_tenders').select('*').order(col, { ascending: true, nullsFirst: false })
    if (status && status !== 'all') q = q.eq('status', status)
    return q
  }

  let { data, error } = await runQuery(sortCol)
  // The deadline column ships in migration 050; if it isn't applied yet the
  // sort errors. Fall back to contract_end so the page still renders.
  if (error && wantDeadline) {
    ;({ data, error } = await runQuery('contract_end'))
  }
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
