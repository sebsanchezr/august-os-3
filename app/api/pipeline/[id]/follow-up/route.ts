import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { searchTranscriptEmails, isGmailConfigured } from '@/lib/google-gmail'
import { draftPipelineFollowUp, type PriorEmail } from '@/lib/pipeline-ai'
import { notifyPipelineFollowUp } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// POST /api/pipeline/[id]/follow-up
// Body: { context?: string }
// Reads the deal, pulls the last Gmail conversation with the contact's email,
// drafts a follow-up (weaving in any context Seb typed), posts it to Discord for
// copy/paste, and returns the draft. Sends nothing to the prospect.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const context = typeof body.context === 'string' ? body.context.trim() : ''

    const supabase = createSupabaseAdmin()
    const { data: deal, error } = await supabase
      .from('pipeline_deals')
      .select('id, prospect_name, company, contact_email, stage, notes')
      .eq('id', params.id)
      .single()

    if (error || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    if (!deal.contact_email) {
      return NextResponse.json(
        { error: 'Add a contact email to this deal before drafting a follow-up.' },
        { status: 400 },
      )
    }

    // Pull the last exchange with this contact from Gmail (read-only). Degrades
    // gracefully: if Gmail is not configured, we still draft from notes + context.
    let priorEmails: PriorEmail[] = []
    let usedEmailHistory = false
    if (isGmailConfigured()) {
      try {
        const email = deal.contact_email
        const found = await searchTranscriptEmails(`from:${email} OR to:${email}`, 5)
        priorEmails = found
          .sort((a, b) => a.internalDate - b.internalDate)
          .map((e) => ({
            from: e.from,
            subject: e.subject,
            date: new Date(e.internalDate).toISOString().slice(0, 10),
            body: e.body || e.snippet,
          }))
        usedEmailHistory = priorEmails.length > 0
      } catch (gmailErr) {
        console.error('[pipeline/follow-up] gmail read failed', gmailErr)
      }
    }

    const draft = await draftPipelineFollowUp({
      prospectName: deal.prospect_name,
      company: deal.company,
      contactEmail: deal.contact_email,
      stage: deal.stage,
      notes: deal.notes,
      priorEmails,
      context,
    })

    notifyPipelineFollowUp(deal, draft, usedEmailHistory)

    return NextResponse.json({ draft, usedEmailHistory })
  } catch (err) {
    console.error('[pipeline/[id]/follow-up POST]', err)
    return NextResponse.json({ error: 'Failed to draft follow-up' }, { status: 500 })
  }
}
