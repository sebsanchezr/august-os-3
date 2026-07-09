import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/accounts/[id]/assets
// Data for the Assets tab: onboarding brief, creative assets, checklist tasks.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, notes, onboarding_id')
    .eq('id', id)
    .single()

  if (error || !client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [formRes, assetsRes, tasksRes] = await Promise.all([
    client.onboarding_id
      ? supabase.from('onboarding_forms').select('*').eq('onboarding_id', client.onboarding_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('client_creative_assets')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, completed_at, track, assignee_id, profiles!tasks_assignee_id_fkey(id, name)')
      .eq('client_id', id)
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('due_date', { ascending: true, nullsFirst: false }),
  ])

  return NextResponse.json(
    {
      notes: client.notes,
      form: formRes.data ?? null,
      assets: assetsRes.data ?? [],
      tasks: tasksRes.data ?? [],
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
