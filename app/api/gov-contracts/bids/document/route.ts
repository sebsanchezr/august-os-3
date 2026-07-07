import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const BUCKET = 'gov-bid-documents'

// GET /api/gov-contracts/bids/document?notice_id=... — returns a short lived
// signed URL for the current bid PDF so it can be opened/downloaded from the
// Bid Manager without exposing a public bucket.
export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdmin()
  const notice_id = new URL(req.url).searchParams.get('notice_id')
  if (!notice_id) return NextResponse.json({ error: 'notice_id required' }, { status: 400 })

  const { data: tender, error } = await supabase
    .from('gov_tenders')
    .select('bid_document_path')
    .eq('notice_id', notice_id)
    .single()

  if (error || !tender?.bid_document_path) {
    return NextResponse.json({ error: 'No bid document on file for this tender' }, { status: 404 })
  }

  const { data: signed, error: signErr } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUrl(tender.bid_document_path, 60 * 10) // 10 minutes

  if (signErr || !signed) {
    return NextResponse.json({ error: signErr?.message ?? 'Could not sign URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}

// POST multipart/form-data { notice_id, file } — uploads (or replaces) the
// bid PDF for a tender, e.g. Seb uploading a revised version after review.
export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdmin()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const notice_id = form.get('notice_id')
  const file = form.get('file')

  if (typeof notice_id !== 'string' || !notice_id) {
    return NextResponse.json({ error: 'notice_id required' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }
  if (file.type && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
  }

  const path = `${notice_id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadErr } = await supabase
    .storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true })

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { error: updateErr } = await supabase
    .from('gov_tenders')
    .update({ bid_document_path: path, last_update: new Date().toISOString().slice(0, 10) })
    .eq('notice_id', notice_id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, path })
}
