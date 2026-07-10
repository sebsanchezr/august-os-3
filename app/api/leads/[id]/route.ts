import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { CallLead } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  let body: Partial<CallLead>

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Strip out read-only / relational fields before update
  const { id: _id, created_at: _ca, updated_at: _ua, callers: _cal, ...updateFields } = body as Record<string, unknown>

  const { data, error } = await supabase
    .from('call_leads')
    .update({ ...updateFields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, callers(id, name, email, active, created_at)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ lead: data as CallLead })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseAdmin()
  const { id } = params

  const { error } = await supabase
    .from('call_leads')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
