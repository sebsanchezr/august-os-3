// Server-side helper for the OS Updates changelog. Any code or agent can call
// logUpdate() to append a team-visible update. Uses the admin client so it works
// from cron jobs, webhooks and scripts that have no user session.

import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { OsUpdate, OsUpdateTag } from '@/lib/types'

export async function logUpdate(
  title: string,
  description?: string,
  tag?: OsUpdateTag,
  commitSha?: string,
): Promise<OsUpdate | null> {
  if (!title || !title.trim()) return null
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('os_updates')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      tag: tag ?? null,
      commit_sha: commitSha ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[logUpdate]', error)
    return null
  }
  return data as OsUpdate
}

// Generic key/value cursor store (table: system_state) used by cron jobs that
// need to remember where they left off, e.g. the changelog cron's last
// processed commit timestamp. See lib/changelog-server.ts.
export async function getSystemState(key: string): Promise<string | null> {
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('system_state')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    console.error('[getSystemState]', error)
    return null
  }
  return data?.value ?? null
}

export async function setSystemState(key: string, value: string): Promise<void> {
  const supabase = createSupabaseAdmin()
  const { error } = await supabase
    .from('system_state')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) {
    console.error('[setSystemState]', error)
  }
}

export async function fetchLatestUpdates(limit = 20): Promise<OsUpdate[]> {
  const supabase = createSupabaseAdmin()
  // The Updates page is the UI/UX changelog only. The daily activity digest
  // (tag 'Digest') still lands in os_updates for other uses but is excluded
  // here so this page shows only shipped product changes.
  const { data, error } = await supabase
    .from('os_updates')
    .select('*')
    .or('tag.is.null,tag.neq.Digest')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[fetchLatestUpdates]', error)
    return []
  }
  return (data ?? []) as OsUpdate[]
}
