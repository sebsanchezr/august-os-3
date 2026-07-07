import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

// POST /api/upwork/inbound
// Called by the Discord bot when Seb reacts/replies to an opportunity post.
// Auth: X-Agent-Key header checked against AGENT_INBOUND_KEY env var.
// Body: { discord_message_id: string, action: 'applied' | 'passed' }
// This only updates our own tracking — it never touches Upwork.
export async function POST(req: NextRequest) {
  const agentKey = process.env.AGENT_INBOUND_KEY
  if (!agentKey) return NextResponse.json({ error: 'Inbound API not configured' }, { status: 503 })
  if (req.headers.get('x-agent-key') !== agentKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.discord_message_id || !body.action) {
    return NextResponse.json({ error: 'discord_message_id and action are required' }, { status: 400 })
  }
  if (body.action !== 'applied' && body.action !== 'passed') {
    return NextResponse.json({ error: 'action must be applied or passed' }, { status: 400 })
  }

  const { data: job } = await supabase
    .from('upwork_jobs')
    .select('id')
    .eq('discord_message_id', body.discord_message_id as string)
    .single()

  if (!job) return NextResponse.json({ error: 'No job found for this Discord message' }, { status: 404 })

  const { data: updated, error } = await supabase
    .from('upwork_jobs')
    .update({ status: body.action })
    .eq('id', job.id)
    .select('*')
    .single()

  if (body.action === 'applied') {
    await supabase.from('upwork_proposals').update({ sent_at: new Date().toISOString() }).eq('job_id', job.id).is('sent_at', null)
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ job: updated })
}
