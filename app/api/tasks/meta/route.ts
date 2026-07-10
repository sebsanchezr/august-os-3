import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/tasks/meta
// Returns profiles and clients for dropdowns in the task UI
export async function GET() {
  const supabase = createSupabaseAdmin()

  const [profilesRes, clientsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, role, discord_user_id, email')
      .eq('active', true)
      .order('name'),
    supabase
      .from('clients')
      .select('id, name, status, services')
      .in('status', ['active', 'paused'])
      .order('name'),
  ])

  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 500 })
  if (clientsRes.error) return NextResponse.json({ error: clientsRes.error.message }, { status: 500 })

  return NextResponse.json({
    profiles: profilesRes.data ?? [],
    clients: clientsRes.data ?? [],
  })
}
