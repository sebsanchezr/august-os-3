import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

const VALID_STATUSES = ['new', 'surfaced', 'applied', 'replied', 'call_booked', 'won', 'passed'] as const

// PATCH /api/upwork/[id]
// Body: { status }. Human-driven status transitions only — this never
// touches Upwork itself (e.g. marking "applied" after Seb submits manually).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const status = body.status as string
  if (!status || !(VALID_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('upwork_jobs')
    .update({ status })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })

  if (status === 'applied') {
    await supabase.from('upwork_proposals').update({ sent_at: new Date().toISOString() }).eq('job_id', params.id).is('sent_at', null)
  }

  return NextResponse.json({ job: data })
}
