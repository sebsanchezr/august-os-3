// Server-only access helpers. Kept separate from lib/access.ts because that
// file is imported by the client nav (components/nav.tsx); importing the
// cookie-based Supabase server client here keeps next/headers out of the
// client bundle.
import { createSupabaseServer } from './supabase-server'
import { FULL_ACCESS } from './access'

// Returns the owner's email if the current request is authenticated as a
// FULL_ACCESS user (Seb), else null. Middleware does NOT role-gate /api/*
// routes, so owner-only API routes MUST call this and 403 on null.
export async function requireOwner(): Promise<string | null> {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const email = (user?.email ?? '').trim().toLowerCase()
  return FULL_ACCESS.includes(email) ? email : null
}
