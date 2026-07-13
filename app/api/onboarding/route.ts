import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/onboarding?status=
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('onboardings')
      // clients is embedded via the explicit FK: onboardings.client_id -> clients.id.
      // Disambiguates from the reverse clients.onboarding_id relationship, which
      // otherwise makes PostgREST reject the whole query (PGRST201).
      .select('*, pipeline_deals(id, prospect_name), clients!onboardings_client_id_fkey(id, name)')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ onboardings: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[onboarding/route GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
