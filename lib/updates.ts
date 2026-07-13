// Server-side helper for the OS Updates changelog. Any code or agent can call
// logUpdate() to append a team-visible update. Uses the admin client so it works
// from cron jobs, webhooks and scripts that have no user session.

import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { OsUpdate, OsUpdateTag } from '@/lib/types'

export async function logUpdate(
  title: string,
  description?: string,
  tag?: OsUpdateTag,
): Promise<OsUpdate | null> {
  if (!title || !title.trim()) return null
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('os_updates')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      tag: tag ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[logUpdate]', error)
    return null
  }
  return data as OsUpdate
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
