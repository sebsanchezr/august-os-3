import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  // Agent-authenticated endpoints use x-agent-key and must bypass Supabase auth
  const isAgentEndpoint = path.startsWith('/api/tasks/inbound')
  // Third-party webhooks (Cal.com, Stripe, SignWell) and the tokenized
  // client onboarding portal have no Supabase session and verify themselves
  // (HMAC signature / portal token), so they must bypass auth here.
  const isWebhookOrPortal =
    path.startsWith('/api/webhooks/') ||
    path.startsWith('/welcome/') ||
    path.startsWith('/api/onboarding/portal/')
  // Vercel Cron has no Supabase session either; the route itself checks
  // CRON_SECRET against the Authorization header Vercel sends.
  const isCronEndpoint = path.startsWith('/api/cron/')
  const isPublicPath = path.startsWith('/login') || path.startsWith('/auth') || isAgentEndpoint || isWebhookOrPortal || isCronEndpoint

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
