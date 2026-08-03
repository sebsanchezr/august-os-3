// Deploys a single static HTML file straight to Vercel via the REST API, one
// project per client (project name = slug). No CLI, no template repo, no
// build step, ready in seconds. Interim path until the multi-tenant
// augustsites app (WEBSITE_SERVICE_BUILD_PLAN.md Phase 1) exists; that plan
// is the one to migrate to once wildcard DNS + the shared app are built.

const VERCEL_API = 'https://api.vercel.com'

function teamQuery(): string {
  const teamId = process.env.VERCEL_TEAM_ID
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export async function deployStaticSite(slug: string, html: string): Promise<{ deployed: boolean; url: string | null; error?: string }> {
  const token = process.env.VERCEL_TOKEN
  if (!token) return { deployed: false, url: null, error: 'VERCEL_TOKEN not configured' }

  try {
    const createRes = await fetch(`${VERCEL_API}/v13/deployments${teamQuery()}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name: slug,
        target: 'production',
        projectSettings: { framework: null },
        files: [{ file: 'index.html', data: html }],
      }),
    })

    const created = await createRes.json()
    if (!createRes.ok) {
      return { deployed: false, url: null, error: created?.error?.message || `Vercel deploy create failed (${createRes.status})` }
    }

    const deploymentId: string = created.id
    let url: string = created.url ? `https://${created.url}` : ''
    let readyState: string = created.readyState || 'QUEUED'

    const deadline = Date.now() + 45_000
    while (readyState !== 'READY' && readyState !== 'ERROR' && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000))
      const pollRes = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}${teamQuery()}`, {
        headers: authHeaders(),
      })
      const polled = await pollRes.json()
      if (!pollRes.ok) break
      readyState = polled.readyState || readyState
      if (polled.url) url = `https://${polled.url}`
    }

    if (readyState !== 'READY') {
      return { deployed: false, url: url || null, error: `Deployment did not become ready in time (state: ${readyState})` }
    }

    // New projects inherit the team's default Deployment Protection (Vercel
    // SSO wall), which would make the demo link unopenable by the prospect.
    // Every demo must be publicly viewable, so strip protection right away.
    try {
      await fetch(`${VERCEL_API}/v9/projects/${slug}${teamQuery()}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ ssoProtection: null, passwordProtection: null }),
      })
    } catch {
      // non-fatal: site still deployed, just flag it so Seb can check manually
    }

    return { deployed: true, url }
  } catch (err) {
    return { deployed: false, url: null, error: err instanceof Error ? err.message : 'Unknown deploy error' }
  }
}
