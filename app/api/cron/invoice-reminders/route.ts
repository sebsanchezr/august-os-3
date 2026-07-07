import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { notifyInvoiceDue } from '@/lib/discord-notify'

export const dynamic = 'force-dynamic'

// GET /api/cron/invoice-reminders
// Runs daily (see vercel.json). Billing itself is manual for now — this only
// reminds Seb on the exact day each active client's 30-day cycle comes
// round again, anchored to clients.start_date (set when the client is
// launched — see /api/onboarding/[id]/launch).
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
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, status, start_date, health')
    .eq('status', 'active')
    .not('start_date', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const due: { id: string; name: string; health?: string; cycleDay: number }[] = []

  for (const client of clients ?? []) {
    const start = new Date(client.start_date as string)
    start.setUTCHours(0, 0, 0, 0)
    const daysElapsed = Math.round((today.getTime() - start.getTime()) / 86400000)
    if (daysElapsed > 0 && daysElapsed % 30 === 0) {
      due.push({ id: client.id, name: client.name, health: client.health, cycleDay: daysElapsed })
    }
  }

  const created: string[] = []

  for (const client of due) {
    const title = `Invoice ${client.name} — 30-day payment due`

    // Idempotent: skip if today's reminder task already exists for this client.
    const { data: existingTask } = await supabase
      .from('tasks')
      .select('id')
      .eq('client_id', client.id)
      .eq('title', title)
      .eq('due_date', todayStr)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingTask) continue

    const { data: task } = await supabase
      .from('tasks')
      .insert({
        title,
        description: `Client's 30-day billing cycle is due again today (day ${client.cycleDay}). Raise and send the next invoice manually — recurring billing isn't automated yet.`,
        track: 'ops',
        department: 'admin',
        client_id: client.id,
        status: 'brief',
        priority: 'high',
        due_date: todayStr,
        source: 'recurring',
      })
      .select('id')
      .single()

    if (task) {
      await supabase.from('task_events').insert({
        task_id: task.id,
        type: 'created',
        payload: { title, source: 'recurring', client_id: client.id },
        occurred_at: new Date().toISOString(),
      })
      created.push(client.id)
    }

    notifyInvoiceDue(client, client.cycleDay)
  }

  return NextResponse.json({ checked: clients?.length ?? 0, due: due.length, tasksCreated: created.length })
}
