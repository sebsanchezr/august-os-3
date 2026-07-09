import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { isMissingTableError, MIGRATION_MISSING_MESSAGE } from '@/lib/creatives'

// PATCH /api/creatives/strategy/[id]
// Body: { action: 'approve' }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (body.action !== 'approve') {
    return NextResponse.json({ error: "action must be 'approve'" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('creative_strategies')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error || !data) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: MIGRATION_MISSING_MESSAGE }, { status: 409 })
    }
    return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ strategy: data })
}
