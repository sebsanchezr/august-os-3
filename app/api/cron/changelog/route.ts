import { NextRequest, NextResponse } from 'next/server'
import { generateChangelog } from '@/lib/changelog-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET/POST /api/cron/changelog
// Runs once a day (see vercel.json), after the daily-digest cron. Pulls new
// commits from sebsanchezr/august-os-3 (main) since the last run, has Haiku
// turn the user-facing ones into os_updates rows, and advances the cursor in
// system_state so the next run only looks at what's new.
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

  const result = await generateChangelog()
  if (result.error) {
    return NextResponse.json(result, { status: 500 })
  }
  return NextResponse.json(result)
}
