import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServer()
    const { id } = params
    const body = await request.json()

    const { status, call_time, demo_url } = body

    const updates: Record<string, unknown> = {}
    if (status !== undefined) updates.status = status
    if (call_time !== undefined) updates.call_time = call_time
    if (demo_url !== undefined) updates.demo_url = demo_url

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        callers ( id, name, email, active, created_at ),
        deals ( * )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ booking })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
