import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET/POST /api/cron/task-archive
// Runs daily (see vercel.json). Archives tasks that finished more than 7 days
// ago so the active board/list stay focused on live work. "Finished" means a
// terminal status (ops 'completed' or creative 'live') with a completed_at
// older than the 7-day cutoff. Archiving is a soft move (sets archived_at);
// nothing is deleted and everything is restorable from the Archive view.
// Idempotent: already-archived and soft-deleted rows are excluded.
const ARCHIVE_AFTER_DAYS = 7

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
  const now = new Date()
  const cutoff = new Date(now.getTime() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000)

  // Backfill: tasks seeded/imported straight into the DB can sit in a terminal
  // status ('completed'/'live') with a null completed_at. Without a completion
  // timestamp the archive query below can never see them, so they linger on the
  // board forever. Stamp completed_at from updated_at (a safe proxy for when the
  // status last changed) so they enter the normal 7-day archive flow. Runs every
  // day, so any future direct-DB completion is caught the next morning.
  // (supabase-js has no column=column update, so backfill row by row.)
  const { data: needsStamp } = await supabase
    .from('tasks')
    .select('id, updated_at')
    .in('status', ['completed', 'live'])
    .is('completed_at', null)
    .is('archived_at', null)
    .is('deleted_at', null)

  for (const t of needsStamp ?? []) {
    await supabase.from('tasks').update({ completed_at: t.updated_at }).eq('id', t.id)
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ archived_at: now.toISOString(), updated_at: now.toISOString() })
    .in('status', ['completed', 'live'])
    .not('completed_at', 'is', null)
    .lt('completed_at', cutoff.toISOString())
    .is('archived_at', null)
    .is('deleted_at', null)
    .select('id')

  if (error) {
    console.error('[task-archive]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const archivedIds = (data ?? []).map((t) => t.id)

  if (archivedIds.length > 0) {
    await supabase.from('task_events').insert(
      archivedIds.map((id) => ({
        task_id: id,
        actor_id: null,
        type: 'archived',
        payload: { reason: `auto-archived ${ARCHIVE_AFTER_DAYS} days after completion` },
        occurred_at: now.toISOString(),
      })),
    )
  }

  return NextResponse.json({ archived: archivedIds.length })
}
