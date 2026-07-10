import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyApprovedComms } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// POST /api/accounts/reports/[id]/approve
// Body: { approved_by: uuid, client_message?: string (if edited inline before approving) }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { body = {} }

  // Fetch the report
  const { data: report, error: fetchErr } = await supabase
    .from('client_reports')
    .select('*, clients(id, name, health)')
    .eq('id', id)
    .single()

  if (fetchErr || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  if (report.status !== 'pending_approval') {
    return NextResponse.json({ error: `Report is already ${report.status}` }, { status: 422 })
  }

  // Allow inline edit of client_message before approving
  const clientMessage = typeof body.client_message === 'string' && body.client_message.trim()
    ? body.client_message.trim()
    : report.client_message

  if (!clientMessage) {
    return NextResponse.json({ error: 'client_message is empty -- cannot approve a report with no client message' }, { status: 422 })
  }

  const now = new Date().toISOString()

  const { data: updated, error: updateErr } = await supabase
    .from('client_reports')
    .update({
      status:       'approved',
      client_message: clientMessage,
      approved_by:  body.approved_by ?? null,
      approved_at:  now,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateErr || !updated) return NextResponse.json({ error: updateErr?.message ?? 'Update failed' }, { status: 500 })

  // Post approved copy to Discord #client-comms
  if (report.clients) {
    notifyApprovedComms(report.clients, clientMessage)
  }

  return NextResponse.json({ report: updated })
}
