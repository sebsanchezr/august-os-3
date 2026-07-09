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

// Local calendar 'YYYY-MM-DD', no UTC shift, so "today" lines up with the date
// picker in the submit form regardless of server timezone.
function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Postgres raises 42P10 ("invalid_column_reference") when an upsert's ON CONFLICT
// target has no matching unique constraint, i.e. migration 026 hasn't run yet.
const MISSING_CONSTRAINT_CODE = '42P10'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { report_date, caller_name, calls_made, positive_replies, calls_booked, notes } = body

    if (!report_date || !caller_name || calls_made === undefined) {
      return NextResponse.json({ error: 'report_date, caller_name, and calls_made are required' }, { status: 400 })
    }

    if (report_date > todayStr()) {
      return NextResponse.json({ error: 'report_date cannot be in the future' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()
    const record = {
      report_date,
      caller_name: caller_name.trim(),
      calls_made: Number(calls_made),
      positive_replies: Number(positive_replies ?? 0),
      calls_booked: Number(calls_booked ?? 0),
      notes: notes?.trim() || null,
    }

    const { data, error } = await supabase
      .from('eod_reports')
      .upsert(record, { onConflict: 'report_date,caller_name' })
      .select()
      .single()

    if (error) {
      if (error.code !== MISSING_CONSTRAINT_CODE) throw error

      // Migration 026 (unique constraint on report_date + caller_name) hasn't been
      // applied yet. Degrade gracefully to a plain insert so submissions still work.
      console.warn('[eod POST] eod_reports_date_caller_unique constraint missing, falling back to insert')
      const { data: insertData, error: insertError } = await supabase
        .from('eod_reports')
        .insert(record)
        .select()
        .single()

      if (insertError) throw insertError
      return NextResponse.json({ report: insertData }, { status: 201 })
    }

    return NextResponse.json({ report: data }, { status: 201 })
  } catch (err) {
    console.error('[eod POST]', err)
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
  }
}
