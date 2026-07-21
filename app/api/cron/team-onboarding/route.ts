import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyStaffReminder } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// GET/POST /api/cron/team-onboarding
// Runs daily (see vercel.json). Two reminder conditions per active onboarding:
//   1. stage is 'intro_booked' but no intro_meeting_at is set -- nudge to book it.
//   2. day7_review_at has passed and the candidate isn't 'active' yet -- nudge
//      Seb + Juan to get the day-7 CEO test call on the calendar.
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

  const supabase = createSupabaseAdmin()
  const { data: onboardings, error } = await supabase
    .from('staff_onboardings')
    .select('id, candidate_name, stage, intro_meeting_at, day7_review_at')
    .neq('stage', 'active')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = new Date()
  let introReminders = 0
  let day7Reminders = 0

  for (const o of onboardings ?? []) {
    const name = o.candidate_name ?? 'Candidate'

    if (o.stage === 'intro_booked' && !o.intro_meeting_at) {
      notifyStaffReminder(
        `Book intro meeting: ${name}`,
        `${name} is ready for their intro call with the Sales Manager — no time booked yet. Get it on the calendar.`,
      )
      introReminders += 1
    }

    if (o.day7_review_at && new Date(o.day7_review_at) <= now && o.stage !== 'active') {
      notifyStaffReminder(
        `Book day-7 review: ${name}`,
        `${name}'s day-7 review window has arrived and they're still at "${o.stage.replace(/_/g, ' ')}". Seb + Juan: get the CEO test call booked.`,
      )
      day7Reminders += 1
    }
  }

  return NextResponse.json({
    checked: onboardings?.length ?? 0,
    introReminders,
    day7Reminders,
  })
}
