import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { CallLead } from '@/lib/types'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(request.url)

  const status = searchParams.get('status')
  const niche = searchParams.get('niche')
  const caller_id = searchParams.get('caller_id')
  const search = searchParams.get('search')

  let query = supabase
    .from('call_leads')
    .select('*, callers(id, name, email, active, created_at)', { count: 'exact' })
    .order('updated_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (niche) query = query.eq('niche', niche)
  if (caller_id) query = query.eq('caller_id', caller_id)
  if (search) {
    query = query.or(`company.ilike.%${search}%,city.ilike.%${search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ leads: data as CallLead[], total: count ?? 0 })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdmin()

  let body: {
    company: string
    phone: string
    city?: string | null
    niche?: string | null
    website?: string | null
    quality_score?: number | null
    caller_id?: string | null
    source?: string | null
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.company || !body.phone) {
    return NextResponse.json({ error: 'company and phone are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('call_leads')
    .insert({
      company: body.company.trim(),
      phone: body.phone.trim(),
      city: body.city ?? null,
      niche: body.niche ?? null,
      website: body.website ?? null,
      quality_score: body.quality_score ?? null,
      caller_id: body.caller_id ?? null,
      source: body.source ?? null,
      status: 'pending',
    })
    .select('*, callers(id, name, email, active, created_at)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ lead: data as CallLead }, { status: 201 })
}
