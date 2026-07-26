import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BUCKET = 'creatives'

// POST /api/creatives/request  (multipart/form-data)
// Fields: client_id, title?, context?, extra_links? (newline/comma), count?,
//   format?, platform?, pull_meta?, pull_trendtrack?, plus 0+ `reference` files.
//
// Uploads any reference creatives to the 'creatives' bucket and queues a
// creative_requests row. A Mac worker (directives/generate_creative_batch.md)
// picks it up, pulls Meta + TrendTrack + the reference, generates, and delivers
// to the client's Drive. This route only intakes the request; it does NOT block
// on generation (which is heavy and runs off-Vercel).
export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const client_id = String(form.get('client_id') ?? '').trim()
  if (!client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  const title = String(form.get('title') ?? '').trim() || null
  const context = String(form.get('context') ?? '').trim() || null
  const count = Math.max(1, Math.min(30, Number(form.get('count')) || 6))
  const format = String(form.get('format') ?? 'static').trim() || 'static'
  const platform = String(form.get('platform') ?? 'Meta').trim() || 'Meta'
  const pull_meta = String(form.get('pull_meta') ?? 'true') !== 'false'
  const pull_trendtrack = String(form.get('pull_trendtrack') ?? 'true') !== 'false'

  const extraRaw = String(form.get('extra_links') ?? '')
  const extra_links = extraRaw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const supabase = createSupabaseAdmin()

  // Confirm the client exists (and get name for messaging).
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', client_id)
    .maybeSingle()
  if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Who requested this (best effort).
  let requestedBy: string | null = null
  try {
    const authed = createSupabaseServer()
    const { data: { user } } = await authed.auth.getUser()
    requestedBy = user?.id ?? null
  } catch {
    requestedBy = null
  }

  // Upload any reference creatives (images or .md). Non-fatal per file.
  const reference_paths: string[] = []
  const reference_urls: string[] = []
  const files = form.getAll('reference').filter((f): f is File => f instanceof File)
  const stamp = Date.now()
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file || file.size === 0) continue
    const safeName = (file.name || `ref-${i}`).replace(/[^\w.\-]+/g, '_').slice(-80)
    const path = `${client_id}/requests/${stamp}-${i}-${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type || 'application/octet-stream', upsert: true })
    if (upErr) {
      console.error('[creatives/request] reference upload failed:', upErr.message)
      continue
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    reference_paths.push(path)
    reference_urls.push(pub.publicUrl)
  }

  const { data: row, error: insErr } = await supabase
    .from('creative_requests')
    .insert({
      client_id,
      requested_by: requestedBy,
      title,
      context,
      reference_paths,
      reference_urls,
      extra_links,
      pull_meta,
      pull_trendtrack,
      count,
      format,
      platform,
      status: 'queued',
    })
    .select('*')
    .single()

  if (insErr) {
    if (insErr.code === '42P01') {
      return NextResponse.json({ error: 'Run migration 056 to enable creative requests.' }, { status: 409 })
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({
    request: row,
    message: `Queued a ${count}-creative ${format} batch for ${client.name}. The engine will generate and deliver to Drive.`,
  })
}

// GET /api/creatives/request?client_id=...  -> recent requests for the history list.
export async function GET(req: NextRequest) {
  const client_id = req.nextUrl.searchParams.get('client_id')
  if (!client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('creative_requests')
    .select('id, title, context, count, format, platform, status, result, error, reference_urls, created_at')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false })
    .limit(25)
  if (error) {
    if (error.code === '42P01') return NextResponse.json({ requests: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ requests: data ?? [] })
}
