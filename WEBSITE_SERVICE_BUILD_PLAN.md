# Website Service Build Plan (Service 3: Web Development)

Fable-authored strategy. Execution by Opus/Sonnet/Haiku. No em-dashes anywhere in output.

## The service in one line
Cold caller books a call with a business that has no (or a bad) website. Moving the CRM
profile to **booked** auto-builds a tailored demo site in minutes and hands the closer a
prep pack. Moving to **won/paid** auto-runs go-live (domain, DNS, email, form routing,
subscription) with zero manual ops.

## What already exists (do not rebuild)
- `website_engine/` (Python, runs on Mac): intake queue via pulse worker, `enrich.py`
  (Apify FB + Google Maps + Haiku judgment), `site_gen.py` builds a complete
  `client.json` (deploy is a STUB), `prep_doc.py` prep pack, `discord_notify.py`
  posts to #sales-call-prep. Trigger today = Cal.com webhook with "website" in title.
- `roofing-template/` (Next.js + Tailwind): full site rendered from `client.json`
  (brand colours, services, towns, reviews, ratings, photos with stock fallback).
- OS CRM: `pipeline_deals` table, stages `new, contacted, positive_reply, booked,
  showed, proposal, won, lost` (migration `010_pipeline.sql`).

Two gaps only: (A) the actual deploy, (B) OS stage-change triggers + CRM write-back +
post-payment go-live.

## Core architecture decision: multi-tenant, zero-deploy sites
Do NOT deploy one Vercel project per prospect. Instead:

- One Vercel project, `augustsites`, running a generalized version of
  `roofing-template` as a **multi-tenant app** on wildcard `*.augustsites.co.uk`.
- Middleware reads the subdomain slug, fetches that client's config row from a new
  Supabase table `website_sites` (slug PK, config jsonb, status, deal_id FK), renders
  the site. ISR/edge cache so repeat loads are static-fast.
- "Building a website" = inserting one row. Demo is live in seconds, not minutes.
  Marginal cost per demo site: Apify scrape + one Haiku call + one Sonnet copy pass,
  roughly £0.05 to £0.15. No builds, no deploy queue, no Vercel project sprawl.
- Paying clients stay on the same project: attach their custom domain to the
  `augustsites` Vercel project via the Vercel Domains API and map domain → slug in
  middleware. Vercel handles SSL automatically.

Trade-off accepted: all client sites share one codebase. That is a feature at this
price point (fixes and improvements ship to every client at once). If a client ever
needs bespoke work, eject their slug to its own repo then.

## Phase 1: template generalization + multi-tenant deploy (Sonnet builds)
1. Fork `roofing-template` into `augustsites/` as the multi-tenant app:
   - `middleware.ts`: extract slug from host (`<slug>.augustsites.co.uk`) or from a
     `custom_domains` lookup; rewrite to `/sites/[slug]`.
   - `/sites/[slug]/page.tsx`: fetch config from Supabase, render existing template
     components. `revalidate` ~1h plus on-demand revalidation endpoint.
   - Trade theming: keep `trade` field driving copy blocks and stock photo set.
     Launch trades: roofing (done), then plumbing, electrician, builder, landscaping
     as copy/stock variants only, same components.
   - Site-level CTA: phone number click-to-call plus a contact form posting to
     `/api/lead` (stores in Supabase `website_leads`, later routed to client).
   - A `status` gate: `demo` sites show a subtle "Preview built by August" ribbon and
     noindex; `live` sites remove it and get real metadata + sitemap.
2. Supabase migration `015_website_sites.sql`:
   - `website_sites(slug pk, deal_id fk, status demo|live|archived, config jsonb,
     custom_domain, created_at, went_live_at)`
   - `website_leads(id, slug fk, name, phone, message, created_at, forwarded bool)`
3. DNS: wildcard `*.augustsites.co.uk` CNAME to Vercel, wildcard domain on project.
4. Wire `site_gen.py`: replace stub with an insert/upsert into `website_sites`
   (service role key already in env) and return the real URL. One function, done.

Acceptance: manual `python process.py book ...` produces a browsable
`<slug>.augustsites.co.uk` in under 2 minutes end to end.

## Phase 2: OS trigger + CRM write-back (Sonnet builds)
1. Trigger on stage change, not only Cal.com: in the OS, when a `pipeline_deals` row
   moves to `booked`, an API route (`/api/website/build`) enqueues the same intake
   payload the pulse worker uses today (business name, trade, town, phone, any FB/site
   URL from the profile). Keep the Cal.com path as a second entry point; dedupe by
   deal_id/slug so double triggers are harmless (idempotent upsert).
2. Runner: `process.py --sync` already polls the queue. Add a launchd/cron entry every
   2 minutes on the Mac so "moved to booked" → site live within ~3 minutes. (Later,
   port enrich+copy to a Vercel cron if Mac dependency hurts; not now, Apify+Python
   works and is cheap.)
3. Write-back to CRM on completion:
   - `pipeline_deals` gets columns (or a `metadata` jsonb): `demo_url`,
     `prep_pack_url`, `website_status`, `enrichment_summary`.
   - OS UI: on the deal card/profile in the booked column, show the demo URL
     (copy button), build status chip (building/ready/failed), and a "Prep pack"
     link. Failed builds ping Discord #sales-call-prep with the error.
4. Prep pack (already generated) additionally saved to Supabase storage and linked on
   the profile so the closer has one place to look: demo URL, business intel, talk
   track, objections, price anchors (finalised offer: £1,995 Full Package with
   white-label GoHighLevel, £950 Website Only floor, £75/mo management never
   discounted; Stripe links already exist in CALLER_SOP.pdf).

Acceptance: drag a deal to booked in the OS, within 3 minutes the card shows a live
demo URL and prep pack, and #sales-call-prep has the embed.

## Phase 3: won/paid → automated go-live (Sonnet builds, Haiku for comms drafts)
Trigger: deal moves to `won` (or Stripe payment webhook confirms, whichever fires
first; require payment before domain spend).

Go-live pipeline (a `website_golive_runs` state machine so every step is resumable
and visible in the OS):
1. **Payment**: existing Stripe payment links (£1,995 / £1,495 / £1,195 / £950 tiers,
   £500 deposit) surfaced on the deal card; add the £75/mo recurring product bundled
   into each setup link (still outstanding). Webhook marks paid. No payment, no
   domain purchase. Deposit-paid = build proceeds, go-live gated on balance.
2. **Domain**: buy via Vercel Domains API (registration + DNS + SSL all automatic;
   supersedes the earlier Cloudflare-at-cost decision because zero DNS work is worth
   the ~£5/yr premium at this volume). Name proposed by
   Haiku from business name + trade + town, human-confirmed with one click in the OS
   (only manual step, since domains are permanent spend).
3. **Attach**: add domain to the `augustsites` project via API, insert into
   `custom_domains` map, flip `website_sites.status` to `live` (ribbon off, indexing
   on, sitemap, meta, favicon from logo).
4. **Email + form routing**: set up `info@<domain>` forwarding (ImprovMX free tier or
   Resend inbound) to the client's real email; `/api/lead` now emails the client via
   Resend and optionally SMS via Twilio (wiring these was deliberately deferred until
   the first paying client, which is exactly when this phase runs, so this is the
   moment to do it). Every lead also logged in `website_leads`
   so we can report "your site got you N enquiries" (retention weapon for the £75/mo).
5. **Polish pass**: one Sonnet call to upgrade demo copy to final copy (remove
   hedges, tighten local SEO: title tags, schema.org LocalBusiness, service pages).
6. **GHL provisioning (£1,995 tier only)**: task auto-created from the GHL setup SOP
   (snapshot → clone sub-account → connect form → hand off LeadConnector app). Manual
   with checklist v1; API-automate once the SOP has run a few times.
7. **Client comms**: auto-send go-live email (Resend) with the live URL, what they
   got, how leads reach them, and the care plan summary. Discord post to team.
7. **CRM**: deal profile shows live URL, domain, renewal date, subscription status.

Acceptance: move a test deal to won, pay a test Stripe link, and the site is on its
own domain with working contact form and client email inside 15 minutes with one
human click (domain confirm).

## Phase 4 (later, not in first build)
- More trade templates and 2 to 3 layout variants per trade so demos don't look
  cloned when two roofers in one town both get called.
- Monthly automated "your website report" email (visits, calls clicked, form leads)
  to justify £75/mo, reusing the reporter patterns from account management.
- Cancellation flow: subscription lapses → status `archived`, site paused page.

## Cost ceiling per unit
Demo: ~£0.10 API costs, £0 hosting marginal. Live client: domain ~£10/yr, hosting £0
marginal on existing Vercel Pro, email forwarding £0. Against £1.5k to £2k + £900/yr
recurring, margin is effectively the whole fee.

## Build order and model assignment
1. Phase 1 (multi-tenant app + deploy wire): Sonnet, ~1 session.
2. Phase 2 (OS trigger + write-back UI): Sonnet, ~1 session.
3. Phase 3 (go-live pipeline): Sonnet with Opus review of the Stripe/domain state
   machine (money-touching code), ~1 to 2 sessions.
Haiku for all runtime comms drafting inside pipelines. Fable does not build.
