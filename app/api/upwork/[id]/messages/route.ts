import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { draftReply } from '@/lib/upwork-ai'

export const dynamic = 'force-dynamic'

// POST /api/upwork/[id]/messages
// Body: { inbound_body: string }
// Seb pastes the client's reply from Upwork (pre-hire proposal replies aren't
// API-readable). We store it, draft a suggested reply, and return the draft
// for approval — nothing is sent to Upwork here.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.inbound_body || typeof body.inbound_body !== 'string') {
    return NextResponse.json({ error: 'inbound_body is required' }, { status: 400 })
  }

  const { data: job } = await supabase.from('upwork_jobs').select('id, title, description, status').eq('id', params.id).single()
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  await supabase.from('upwork_messages').insert({
    job_id: params.id,
    direction: 'inbound',
    body: (body.inbound_body as string).trim(),
    ai_generated: false,
    status: 'received',
  })

  if (job.status === 'applied') {
    await supabase.from('upwork_jobs').update({ status: 'replied' }).eq('id', params.id)
  }

  const { data: thread } = await supabase
    .from('upwork_messages')
    .select('direction, body')
    .eq('job_id', params.id)
    .order('created_at', { ascending: true })

  const draft = await draftReply({ title: job.title, description: job.description }, thread ?? [])

  const { data: draftRow, error } = await supabase
    .from('upwork_messages')
    .insert({ job_id: params.id, direction: 'outbound', body: draft, ai_generated: true, status: 'draft' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ draft: draftRow })
}
