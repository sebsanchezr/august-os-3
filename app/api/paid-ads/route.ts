import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const PRICE = 97
// Pipeline stages. LP inserts 'in_progress' → normalised to 'new'.
// The customer-facing tracker only reacts to 'delivered'.
const STAGES = ['new', 'brief', 'production', 'review', 'delivered'] as const
const VALID = new Set<string>(STAGES)

function normStage(s: string | null): string {
  if (!s || s === 'in_progress') return 'new'
  return VALID.has(s) ? s : 'new'
}

// GET — orders (with normalised stage) + headline metrics
export async function GET() {
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('ce_website_forms')
    .select('id, business, revenue, timeline, email, status, delivered_at, created_at')
    .eq('source', 'purescale_97_order')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orders = (data ?? []).map((o) => ({ ...o, stage: normStage(o.status) }))
  const delivered = orders.filter((o) => o.stage === 'delivered').length
  const metrics = {
    total: orders.length,
    delivered,
    inProgress: orders.length - delivered,
    revenue: orders.length * PRICE,
  }
  return NextResponse.json({ orders, metrics })
}

// PATCH — move an order to a pipeline stage (incl. 'delivered', which flips the
// customer's landing-page tracker).
export async function PATCH(req: NextRequest) {
  let body: { id?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.id || !body.status || !VALID.has(body.status)) {
    return NextResponse.json({ error: 'id and valid stage required' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { error } = await supabase
    .from('ce_website_forms')
    .update({
      status: body.status,
      delivered_at: body.status === 'delivered' ? new Date().toISOString() : null,
    })
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
