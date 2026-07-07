# Cold Call OS — Build Plan

**For the executor model (Sonnet / Haiku).** Build a sleek internal dashboard that
puts the entire cold-call operation in one place: live metrics, the lead/call
tracker callers work from daily, the pipeline from booked → closed, and a
resources hub with every SOP, script, link and doc. Planned by Opus; you build it.

---

## Golden rules (read first)
1. **Keep the backend. Rebuild only the frontend.** The Cloudflare Worker
   `august-pulse-api` (`pulse/worker.js`) + its KV, and Supabase, hold LIVE data
   (bookings, replies, cold-call leads). Do NOT delete them. "Scrap the OS" means
   replace the old dashboard UI, not wipe data services.
2. **Step 0 — locate & archive the current OS frontend** before calling anything
   deleted. It's not in this repo (likely a Claude artifact or separate Cloudflare
   Pages / Vercel project). Find where it's deployed, export/screenshot it, THEN
   supersede it with this build. If it can't be found, proceed — this replaces it.
3. Match the existing stack conventions (see `roofing-template/`, `funnel/`,
   `adcreatives-lp/` — all Next.js 14 App Router + TypeScript + Tailwind on Vercel).
4. Sleek is the point. This is Seb's command centre. Reference the quality bar of
   `roofing-template/` (spacing, typography, dark sections, real polish).

---

## Tech stack
- **Frontend:** Next.js 14 App Router + TypeScript + Tailwind, deployed on Vercel
  (new dir `cold_call_os/app` — this file sits at the repo root of that project).
- **Backend / data:** **Supabase** (Postgres) as source of truth — already in the
  stack (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY` in `lead_pipeline/.env`). Postgres
  is required for clean 7d/30d aggregation + per-caller leaderboards (KV blobs
  can't do this). Server components / route handlers query Supabase with the
  service key (server-only, never exposed to client).
- **Migration:** one-time script to pull the existing `call_sync` KV blob
  (`GET https://august-pulse-api.seb-52a.workers.dev/call-sync`) and the
  `/bookings` data into the Supabase tables below.
- **Auth:** simple login gate — Supabase Auth (email/password) OR a shared-password
  middleware. Small team, keep it frictionless. Callers must reach it on mobile.

---

## Data model (Supabase tables)
```
callers        (id, name, email, active, created_at)
call_leads     (id, company, phone, city, niche, website, quality_score,
                status, caller_id, source, created_at, updated_at)
                -- status: pending | no_answer | not_interested | callback | booked | closed | dead
call_activity  (id, lead_id, caller_id, outcome, notes, created_at)
                -- outcome: dial | no_answer | not_interested | callback | positive | booked
                -- ONE row per logged call — this powers every metric
bookings       (id, lead_id, caller_id, business_name, phone, call_time,
                demo_url, prep_doc_url, status, created_at)
                -- fed from Cal.com /bookings + website_intake; status: booked | showed | no_show | closed | lost
deals          (id, lead_id, booking_id, tier, setup_amount, monthly_amount,
                payment_type, stripe_ref, status, closed_at, caller_id)
                -- tier: full_1995 | website_950 | custom ; payment_type: full | deposit | clearpay
                -- status: deposit_paid | paid | live
```
All metrics derive from `call_activity`, `bookings`, `deals` filtered by date window.

---

## Pages / tabs

### 1. Dashboard (home)
The at-a-glance command centre. **7-day / 30-day toggle** at the top drives everything.
- **KPI cards:** Calls made · Positive replies · Calls booked · Deals closed ·
  Revenue (setup + MRR added) · Close rate (closed ÷ booked) · Book rate (booked ÷ calls).
  Each card shows the number + % change vs the previous equivalent window.
- **Trend chart:** calls / booked / closed over the window (simple line or bar).
- **Per-caller leaderboard:** table ranked by closed/booked — calls, positives,
  booked, closed, revenue per caller. (Motivates the team; Seb tracks performance.)
- **Recent activity feed:** latest logged calls + bookings + closes, live.

### 2. Call Tracker (the caller's daily workspace)
- Filterable/searchable table of `call_leads` (by status, caller, niche, city).
- Each row: company, phone (click-to-call `tel:`), city, niche, website, quality
  score, status, last activity.
- **Log a call** inline or in a drawer: pick outcome, add notes, one tap → writes a
  `call_activity` row and updates lead status. Fast, mobile-friendly (callers use phones).
- "Mark booked" promotes a lead into `bookings`.
- Bulk import leads (CSV / paste) so new scraped lists drop straight in.

### 3. Pipeline
- Kanban: **Booked → Showed → Closed / Lost** (from `bookings` + `deals`).
- Each card: business, call time, links to the **live demo site** and the
  **Discord prep pack**, deal value if closed.
- Drag to move stage; closing a card opens a quick deal form (tier, amount,
  payment type, Stripe ref).

### 4. Resources hub (everything callers need, one place)
- **Caller SOP** (link/embed `CALLER_SOP.pdf`)
- **Stripe payment links** (all 5, incl. £500 deposit) — copy-to-clipboard buttons
- **Demo site URL** (roofing-template) + how to send it
- **Cold-call script / objection handling** (from the SOP)
- **GHL / lead-tracking setup notes** (once the GHL SOP exists)
- Anything else the caller opens mid-call — designed so nothing is ever hunted for.

---

## Metric definitions (exact, so the dashboard is trustworthy)
- **Calls made** = `count(call_activity)` in window (every dial logged).
- **Positive replies** = `call_activity.outcome IN (positive, callback, booked)`.
- **Calls booked** = `count(bookings where created_at in window)`.
- **Deals closed** = `count(deals where status IN (paid, live) and closed_at in window)`.
- **Revenue** = `sum(deals.setup_amount)` + `sum(deals.monthly_amount)` (show MRR separately).
- **Book rate** = booked ÷ calls made. **Close rate** = closed ÷ booked.
- All windows: last 7 days, last 30 days, with prior-period comparison for the %.

---

## Build phases (suggested order)
1. **Scaffold** Next.js + Tailwind + Supabase client; login gate. Match roofing-template config.
2. **Supabase schema** — create the 5 tables (SQL migration file), seed `callers`.
3. **Migration script** — pull KV `/call-sync` + `/bookings` into Supabase.
4. **Call Tracker page** — the highest-value page; callers can work from it day one.
5. **Dashboard** — KPIs + windows + leaderboard + chart.
6. **Pipeline** — kanban + deal capture.
7. **Resources hub** — links, SOP, Stripe buttons.
8. **Deploy to Vercel**, password-protect, test on mobile.

## Definition of done
- Deployed, logged-in, works on mobile.
- A caller can: see the lead list, click-to-call, log an outcome in 2 taps, mark booked.
- Dashboard shows real 7d/30d numbers from logged activity, per-caller.
- Pipeline reflects real bookings; closing a deal records revenue.
- Every SOP/link/script reachable from Resources in one tap.
- Old OS located + archived (or confirmed superseded).

## Open questions to confirm with Seb before/while building
- Where is the current OS deployed (to archive it)?
- Supabase Auth vs shared password? (Recommend Supabase Auth for per-caller attribution.)
- Keep writing to the Cloudflare Worker KV for backwards-compat, or fully cut over to Supabase?
