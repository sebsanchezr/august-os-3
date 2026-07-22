import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const PRICE = 97

// GET — list $97 orders + headline metrics
export async function GET() {
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('ce_website_forms')
    .select('id, business, revenue, timeline, email, status, delivered_at, created_at')
    .eq('source', 'purescale_97_order')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orders = data ?? []
  const delivered = orders.filter((o) => o.status === 'delivered').length
  const metrics = {
    total: orders.length,
    delivered,
    inProgress: orders.length - delivered,
    revenue: orders.length * PRICE,
  }
  return NextResponse.json({ orders, metrics })
}

// PATCH — mark an order delivered (flips the landing-page tracker to Delivered)
export async function PATCH(req: NextRequest) {
  let body: { id?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const delivered = body.status !== 'in_progress'
  const { error } = await supabase
    .from('ce_website_forms')
    .update({
      status: delivered ? 'delivered' : 'in_progress',
      delivered_at: delivered ? new Date().toISOString() : null,
    })
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
