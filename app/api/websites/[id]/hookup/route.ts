import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/websites/[id]/hookup — the post-payment hookup checklist for a build.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('website_hookup_tasks')
      .select('*')
      .eq('build_id', params.id)
      .order('position', { ascending: true })
    if (error) throw error
    return NextResponse.json({ tasks: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[hookup GET]', err)
    return NextResponse.json({ error: 'Failed to load hookup tasks' }, { status: 500 })
  }
}

// PATCH /api/websites/[id]/hookup — toggle one task done. When every task is
// done the build flips to 'live'; if any is reopened it drops back to 'in_progress'.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const { taskId, done } = body as { taskId?: string; done?: boolean }
    if (!taskId || typeof done !== 'boolean') {
      return NextResponse.json({ error: 'taskId and done are required' }, { status: 400 })
    }
    const supabase = createSupabaseAdmin()
    await supabase.from('website_hookup_tasks').update({ done }).eq('id', taskId).eq('build_id', params.id)

    const { data: tasks } = await supabase
      .from('website_hookup_tasks')
      .select('done')
      .eq('build_id', params.id)
    const all = tasks ?? []
    const allDone = all.length > 0 && all.every(t => t.done)
    await supabase
      .from('website_builds')
      .update({
        hookup_status: allDone ? 'live' : 'in_progress',
        ...(allDone ? { status: 'live' } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    const { data: updated } = await supabase
      .from('website_hookup_tasks')
      .select('*')
      .eq('build_id', params.id)
      .order('position', { ascending: true })
    return NextResponse.json({ tasks: updated ?? [], allDone })
  } catch (err) {
    console.error('[hookup PATCH]', err)
    return NextResponse.json({ error: 'Failed to update hookup task' }, { status: 500 })
  }
}
