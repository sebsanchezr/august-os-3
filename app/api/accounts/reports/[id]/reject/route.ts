import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

// POST /api/accounts/reports/[id]/reject
// Body: { rejection_note: string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { body = {} }

  const { data: report } = await supabase
    .from('client_reports')
    .select('status')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  if (report.status !== 'pending_approval') {
    return NextResponse.json({ error: `Report is already ${report.status}` }, { status: 422 })
  }

  const { data: updated, error } = await supabase
    .from('client_reports')
    .update({
      status:         'rejected',
      rejection_note: (body.rejection_note as string)?.trim() ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error || !updated) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  return NextResponse.json({ report: updated })
}
