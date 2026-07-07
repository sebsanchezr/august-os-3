import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { CallActivity, CallOutcome, LeadStatus } from '@/lib/types'

// Map call outcome to lead status
function outcomeToLeadStatus(outcome: CallOutcome): LeadStatus | null {
  const map: Partial<Record<CallOutcome, LeadStatus>> = {
    no_answer: 'no_answer',
    not_interested: 'not_interested',
    callback: 'callback',
    positive: 'callback', // stays callback until officially booked
    booked: 'booked',
  }
  return map[outcome] ?? null
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdmin()

  // Get current user from session for caller_id
  const cookieStore = cookies()
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabaseUser.auth.getUser()

  let body: {
    lead_id: string
    outcome: CallOutcome
    notes?: string | null
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.lead_id || !body.outcome) {
    return NextResponse.json({ error: 'lead_id and outcome are required' }, { status: 400 })
  }

  // Look up caller row for this user
  let callerId: string | null = null
  if (user?.id) {
    const { data: callerRow } = await supabase
      .from('callers')
      .select('id')
      .eq('id', user.id)
      .single()
    callerId = callerRow?.id ?? null
  }

  // Insert call activity
  const { data: activity, error: activityError } = await supabase
    .from('call_activity')
    .insert({
      lead_id: body.lead_id,
      caller_id: callerId,
      outcome: body.outcome,
      notes: body.notes ?? null,
    })
    .select('*, callers(id, name, email, active, created_at), call_leads(id, company, phone, city, niche, website, quality_score, status, caller_id, source, created_at, updated_at)')
    .single()

  if (activityError) {
    return NextResponse.json({ error: activityError.message }, { status: 500 })
  }

  // Update lead status if outcome has a mapped status
  const newLeadStatus = outcomeToLeadStatus(body.outcome)
  if (newLeadStatus) {
    await supabase
      .from('call_leads')
      .update({ status: newLeadStatus, updated_at: new Date().toISOString() })
      .eq('id', body.lead_id)
  }

  return NextResponse.json({ activity: activity as CallActivity }, { status: 201 })
}
