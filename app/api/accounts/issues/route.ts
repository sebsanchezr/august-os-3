import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyIssueRaised } from '@/lib/discord-notify'

const VALID_CATEGORIES = [
  'financial_reporting', 'performance', 'execution_quality', 'communication',
  'process', 'client_side', 'value_for_money', 'personality_clash',
] as const

const VALID_SEVERITIES = ['minor', 'major', 'trust_threatening'] as const

// GET /api/accounts/issues
// ?client_id=xxx  &status=open|resolving|resolved  &severity=...
export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const { searchParams } = new URL(req.url)

  const clientId = searchParams.get('client_id')
  const status = searchParams.get('status')
  const severity = searchParams.get('severity')

  let query = supabase
    .from('client_issues')
    .select(`
      *,
      owner:profiles!client_issues_owner_profile_id_fkey(id, name),
      clients(id, name, health)
    `)
    .order('raised_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)
  if (status) query = query.eq('status', status)
  if (severity) query = query.eq('severity', severity)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ issues: data ?? [] })
}

// POST /api/accounts/issues
export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdmin()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.client_id) return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  if (!body.category) return NextResponse.json({ error: 'category is required' }, { status: 400 })
  if (!body.description || typeof body.description !== 'string') {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }

  const category = body.category as string
  const severity = (body.severity as string) || 'minor'

  if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 })
  }
  if (!(VALID_SEVERITIES as readonly string[]).includes(severity)) {
    return NextResponse.json({ error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}` }, { status: 400 })
  }

  const { data: issue, error } = await supabase
    .from('client_issues')
    .insert({
      client_id:        body.client_id,
      category,
      severity,
      description:      (body.description as string).trim(),
      owner_profile_id: body.owner_profile_id ?? null,
      root_cause:       body.root_cause ?? null,
      resolution:       body.resolution ?? null,
      process_fix:      body.process_fix ?? null,
    })
    .select()
    .single()

  if (error || !issue) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })

  // Fire Discord for major/trust-threatening or financial_reporting (Genflow: same-day, founder-handled)
  const alertSeverities = ['trust_threatening', 'major']
  const alertCategories = ['financial_reporting']
  if (alertSeverities.includes(severity) || alertCategories.includes(category)) {
    const { data: client } = await supabase.from('clients').select('id, name, health').eq('id', body.client_id as string).single()
    if (client) notifyIssueRaised(issue, client)
  }

  return NextResponse.json({ issue }, { status: 201 })
}
