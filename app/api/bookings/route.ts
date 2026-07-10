import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createSupabaseServer()

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        callers ( id, name, email, active, created_at ),
        deals ( * )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ bookings: data })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer()
    const body = await request.json()

    const { lead_id, business_name, phone, call_time, demo_url, caller_id } = body

    if (!business_name) {
      return NextResponse.json({ error: 'business_name is required' }, { status: 400 })
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        lead_id: lead_id ?? null,
        business_name,
        phone: phone ?? null,
        call_time: call_time ?? null,
        demo_url: demo_url ?? null,
        caller_id: caller_id ?? null,
        status: 'booked',
      })
      .select(`
        *,
        callers ( id, name, email, active, created_at ),
        deals ( * )
      `)
      .single()

    if (bookingError) {
      return NextResponse.json({ error: bookingError.message }, { status: 500 })
    }

    // Update lead status to 'booked' if lead_id provided
    if (lead_id) {
      await supabase
        .from('call_leads')
        .update({ status: 'booked', updated_at: new Date().toISOString() })
        .eq('id', lead_id)
    }

    return NextResponse.json({ booking }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
