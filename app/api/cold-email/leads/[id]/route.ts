import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()

  const [leadRes, eventsRes, pipelineRes] = await Promise.all([
    supabase.from('ce_leads').select('*').eq('id', params.id).single(),
    supabase
      .from('ce_events')
      .select('*')
      .eq('lead_id', params.id)
      .order('occurred_at', { ascending: false }),
    supabase
      .from('ce_pipeline')
      .select('*')
      .eq('lead_id', params.id)
      .order('stage_entered_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (leadRes.error) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  return NextResponse.json({
    lead: leadRes.data,
    events: eventsRes.data ?? [],
    pipeline: pipelineRes.data ?? null,
  })
}
