import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer()
    const body = await request.json()

    const {
      booking_id,
      lead_id,
      tier,
      setup_amount,
      monthly_amount,
      payment_type,
      stripe_ref,
      caller_id,
    } = body

    if (!booking_id || !tier || setup_amount === undefined || monthly_amount === undefined || !payment_type) {
      return NextResponse.json(
        { error: 'booking_id, tier, setup_amount, monthly_amount, and payment_type are required' },
        { status: 400 }
      )
    }

    // Create the deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        booking_id,
        lead_id: lead_id ?? null,
        tier,
        setup_amount,
        monthly_amount,
        payment_type,
        stripe_ref: stripe_ref ?? null,
        caller_id: caller_id ?? null,
        status: 'deposit_paid',
        closed_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (dealError) {
      return NextResponse.json({ error: dealError.message }, { status: 500 })
    }

    // Close the booking
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ status: 'closed' })
      .eq('id', booking_id)

    if (bookingError) {
      return NextResponse.json({ error: bookingError.message }, { status: 500 })
    }

    // Update lead status to 'closed' if lead_id provided
    if (lead_id) {
      await supabase
        .from('call_leads')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', lead_id)
    }

    return NextResponse.json({ deal }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
