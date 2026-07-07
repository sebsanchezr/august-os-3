import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('eod_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return NextResponse.json({ reports: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[eod GET]', err)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { report_date, caller_name, calls_made, positive_replies, calls_booked, notes } = body

    if (!report_date || !caller_name || calls_made === undefined) {
      return NextResponse.json({ error: 'report_date, caller_name, and calls_made are required' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('eod_reports')
      .insert({
        report_date,
        caller_name: caller_name.trim(),
        calls_made: Number(calls_made),
        positive_replies: Number(positive_replies ?? 0),
        calls_booked: Number(calls_booked ?? 0),
        notes: notes?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ report: data }, { status: 201 })
  } catch (err) {
    console.error('[eod POST]', err)
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
  }
}
