import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { searchJobs, isUpworkConfigured, UpworkNotConfiguredError } from '@/lib/upwork'
import { scoreFit, draftProposal, draftLoomScript } from '@/lib/upwork-ai'
import { notifyUpworkOpportunity } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const KEYWORDS = ['paid ads', 'ad creative', 'facebook ads', 'meta ads']
const MIN_BUDGET = 2000
const FIT_THRESHOLD = 6

// GET/POST /api/cron/upwork-search
// Runs every few hours (see vercel.json). Read-only: searches Upwork for ICP-
// matching jobs, scores fit, drafts a proposal + Loom script, and surfaces
// anything above threshold to Discord. Never submits anything to Upwork.
export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!isUpworkConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'Upwork API credentials not configured' })
  }

  const supabase = createSupabaseAdmin()
  let surfaced = 0
  let dropped = 0
  const errors: string[] = []

  for (const keywords of KEYWORDS) {
    try {
      const jobs = await searchJobs({ keywords, minBudget: MIN_BUDGET, expertOnly: true, paymentVerifiedOnly: true })

      for (const job of jobs) {
        const { data: existing } = await supabase
          .from('upwork_jobs')
          .select('id')
          .eq('upwork_job_id', job.upworkJobId)
          .maybeSingle()
        if (existing) continue

        const fit = await scoreFit({ title: job.title, description: job.description, budget: job.budget, proposals_count: job.proposalsCount })

        const { data: inserted, error: insertError } = await supabase
          .from('upwork_jobs')
          .insert({
            upwork_job_id: job.upworkJobId,
            title: job.title,
            description: job.description,
            budget: job.budget,
            budget_type: job.budgetType,
            proposals_count: job.proposalsCount,
            client_country: job.clientCountry,
            client_size: job.clientSize,
            payment_verified: job.paymentVerified,
            contractor_tier: job.contractorTier,
            job_url: job.jobUrl,
            raw: job.raw,
            fit_score: fit.score,
            fit_rationale: fit.rationale,
            status: fit.score >= FIT_THRESHOLD ? 'surfaced' : 'passed',
            surfaced_at: fit.score >= FIT_THRESHOLD ? new Date().toISOString() : null,
          })
          .select('*')
          .single()

        if (insertError || !inserted) {
          errors.push(insertError?.message ?? 'insert failed')
          continue
        }

        if (fit.score < FIT_THRESHOLD) {
          dropped++
          continue
        }

        const [coverLetter, loomScript] = await Promise.all([
          draftProposal({ title: job.title, description: job.description }),
          draftLoomScript({ title: job.title, description: job.description }),
        ])

        await supabase.from('upwork_proposals').insert({
          job_id: inserted.id,
          cover_letter: coverLetter,
          loom_script: loomScript,
        })

        const discordMessageId = await notifyUpworkOpportunity({
          id: inserted.id,
          title: inserted.title,
          budget: inserted.budget,
          budget_type: inserted.budget_type,
          proposals_count: inserted.proposals_count,
          job_url: inserted.job_url,
          fit_score: inserted.fit_score,
          fit_rationale: inserted.fit_rationale,
        })

        if (discordMessageId) {
          await supabase.from('upwork_jobs').update({ discord_message_id: discordMessageId }).eq('id', inserted.id)
        }

        surfaced++
      }
    } catch (e) {
      if (e instanceof UpworkNotConfiguredError) {
        return NextResponse.json({ skipped: true, reason: e.message })
      }
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  return NextResponse.json({ surfaced, dropped, errors })
}
