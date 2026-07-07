import { NextRequest, NextResponse } from 'next/server'

const TOKEN_URL = 'https://www.upwork.com/api/v3/oauth2/token'

// GET /api/upwork/oauth/callback
// One-time-use route: Upwork redirects here after Seb authorizes the app.
// Exchanges the authorization code for an access + refresh token pair and
// prints the refresh token so it can be copied into UPWORK_REFRESH_TOKEN.
// Not used again after that — day-to-day search uses the refresh token
// directly via lib/upwork.ts.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Missing code param. Start from the Upwork authorize URL.' }, { status: 400 })

  const clientId = process.env.UPWORK_CLIENT_ID
  const clientSecret = process.env.UPWORK_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'UPWORK_CLIENT_ID/SECRET not configured in this environment' }, { status: 503 })
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${req.nextUrl.origin}/api/upwork/oauth/callback`,
    }),
  })

  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: 'Token exchange failed', details: data }, { status: 500 })

  return new NextResponse(
    `<html><body style="font-family:monospace;padding:2rem;background:#0c0d11;color:#e4e6f0">
      <h2>Upwork connected</h2>
      <p>Copy this refresh token into the <code>UPWORK_REFRESH_TOKEN</code> env var, then delete this page from history:</p>
      <pre style="background:#181b27;padding:1rem;border-radius:8px;word-break:break-all">${data.refresh_token}</pre>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } },
  )
}
