import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { Caller } from '@/lib/types'

// GET /api/callers
// Returns all callers (used to populate caller-assignment dropdowns)
export async function GET(_req: NextRequest) {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase
    .from('callers')
    .select('id, name, email, active, created_at')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ callers: data as Caller[] })
}
