// Server-only access helpers. Kept separate from lib/access.ts because that
// file is imported by the client nav (components/nav.tsx); importing the
// cookie-based Supabase server client here keeps next/headers out of the
// client bundle.
import { createSupabaseServer } from './supabase-server'
import { FULL_ACCESS, getRole } from './access'

// Returns the owner's email if the current request is authenticated as a
// FULL_ACCESS user (Seb), else null. Middleware does NOT role-gate /api/*
// routes, so owner-only API routes MUST call this and 403 on null.
export async function requireOwner(): Promise<string | null> {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const email = (user?.email ?? '').trim().toLowerCase()
  return FULL_ACCESS.includes(email) ? email : null
}

// Returns true if the current request is authenticated as a FULL_ACCESS user
// (Seb). Use to decide whether an /api/* route may include revenue/financial
// figures in its response — middleware does NOT role-gate API routes.
export async function isOwnerRequest(): Promise<boolean> {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return getRole(user?.email) === 'FULL_ACCESS'
}
