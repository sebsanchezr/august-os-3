import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createSupabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            )
          } catch {
            // setAll called from Server Component — cookies can only be set in middleware or Route Handlers
          }
        },
      },
    }
  )
}

export function createSupabaseAdmin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )
}

// The LinkedIn Ghost engine writes leads/lead_activities/reply_conversations
// into a separate Supabase project (the lead_pipeline project), not the OS
// project used by createSupabaseAdmin(). Anything reading that data (e.g. the
// LinkedIn dashboard) must use this client instead.
export function createLeadPipelineAdmin() {
  const url = process.env.LEAD_PIPELINE_SUPABASE_URL
  const key = process.env.LEAD_PIPELINE_SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing LEAD_PIPELINE_SUPABASE_URL / LEAD_PIPELINE_SUPABASE_SERVICE_KEY env vars'
    )
  }
  return createServerClient(url, key, {
    cookies: {
      getAll() { return [] },
      setAll() {},
    },
  })
}
