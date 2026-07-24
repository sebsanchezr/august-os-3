# FINANCE_BUILD_PLAN.md — Owner-only monthly P&L section

Status: SPEC (ready to execute). Author: Fable. Execution: Opus/Sonnet.
Goal: an owner-only `/finance` section in the OS that tracks the agency's **consolidated monthly P&L** (Tide + Lillys/Revolut + Stripe), the way it was worked out manually for June 2026. Source of truth for the numbers + methodology: the workspace file `finance/june_2026_pnl.md` in "AM Agency Workspace 2", and the memory note `agency-finance-structure`.

## Non-negotiable: OWNER-ONLY access
Finance data must be visible to **Seb only** (`seb@augustmarketing.co.uk` = the sole `FULL_ACCESS` in `lib/access.ts`).

1. **Page gating is automatic.** Do NOT add `/finance` to `COLD_CALLER_PREFIXES`, `FULFILMENT_PREFIXES`, or `ALWAYS_ALLOWED_PREFIXES` in `lib/access.ts`. Non-owner roles then fail `canAccessPath('/finance')` → middleware redirects them; `filterNav` hides the nav item. Only `FULL_ACCESS` returns `true`. No new page-guard code needed.
2. **API gating is NOT automatic — you MUST add it.** `middleware.ts` skips `/api/*` for role checks, and finance routes will use `createSupabaseAdmin()` (service key, bypasses RLS). So every `/api/finance/*` handler MUST verify the caller is the owner. Add this helper to `lib/access.ts`:
   ```ts
   // Returns the owner's email if the request is from a FULL_ACCESS user, else null.
   export async function requireOwner(): Promise<string | null> {
     const supabase = createSupabaseServer() // anon + user cookies (NOT admin)
     const { data: { user } } = await supabase.auth.getUser()
     const email = (user?.email ?? '').toLowerCase()
     return FULL_ACCESS.includes(email) ? email : null
   }
   ```
   Call at the top of EVERY `/api/finance/*` handler:
   ```ts
   if (!(await requireOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
   ```
3. **Do not rely on RLS** — every table's policy is permissive `authenticated USING(true)`. App-layer checks above are the real gate. (Fine to still add the standard RLS policy for consistency.)

## Data model — migration `054_finance.sql`
Match `048_team.sql` conventions (UUID PK `gen_random_uuid()`, `NUMERIC` money in GBP major units, `TIMESTAMPTZ DEFAULT NOW()`, permissive RLS policy, `IF NOT EXISTS` indexes).

### Table `finance_transactions` (the categorized ledger)
One row per categorized line across all sources. This is the detail the P&L aggregates.
| column | type | notes |
|---|---|---|
| id | UUID PK | |
| month | DATE NOT NULL | first day of the P&L month, e.g. `2026-06-01` |
| txn_date | DATE | actual transaction date |
| source | TEXT NOT NULL | `tide` \| `revolut_lillys` \| `stripe` \| `cash` \| `personal` |
| direction | TEXT NOT NULL | `in` \| `out` |
| category | TEXT NOT NULL | `revenue` \| `cost_of_sales` \| `team` \| `contractors` \| `acquisition_tools` \| `delivery_tools` \| `overhead` \| `regulatory` \| `owner_drawings` \| `internal_transfer` \| `store_excluded` |
| treatment | TEXT NOT NULL | `revenue` \| `opex` \| `drawings` \| `eliminated` \| `excluded` — the management treatment that drives the P&L math |
| label | TEXT NOT NULL | human label, e.g. `Anthropic`, `Taij (media buyer)`, `DiSanti fee` |
| counterparty | TEXT | raw statement payee |
| amount | NUMERIC NOT NULL | GBP major units, always positive; `direction` carries the sign |
| is_agency | BOOLEAN NOT NULL DEFAULT true | false = Lillys store, carved out |
| client_id | UUID NULL REFERENCES clients(id) | link revenue to a client where known |
| flag | TEXT NULL | open item to resolve (e.g. "identify client", "duplicate?") |
| notes | TEXT NULL | |
| created_at / updated_at | TIMESTAMPTZ | |

Indexes: `(month)`, `(source)`, `(category)`.

### Table `finance_months` (per-month summary + lock)
| column | type | notes |
|---|---|---|
| month | DATE PRIMARY KEY | `2026-06-01` |
| status | TEXT NOT NULL DEFAULT 'draft' | `draft` \| `final` |
| revenue_total | NUMERIC | cached from ledger (treatment='revenue') |
| cost_total | NUMERIC | cached (treatment in opex+cost_of_sales) |
| operating_profit | NUMERIC | revenue_total − cost_total |
| operating_margin | NUMERIC | profit / revenue |
| owner_drawings | NUMERIC | sum(treatment='drawings') |
| sustainable_draw | NUMERIC | = operating_profit (the number Seb can take without shrinking cash) |
| narrative | TEXT | short plain-English summary + open flags |
| created_at / updated_at | TIMESTAMPTZ | |

Totals can be recomputed by the API from `finance_transactions`; `finance_months` caches them + holds status/narrative. When `status='final'`, treat the month as locked.

## API — `app/api/finance/route.ts` (+ owner check)
`export const dynamic = 'force-dynamic'`, `Cache-Control: no-store`, `createSupabaseAdmin()` for data, `requireOwner()` gate first.
- `GET /api/finance?month=2026-06` → `{ summary, byCategory, bySource, transactions, flags, liveSignals }`.
- `summary` = the `finance_months` row (revenue/cost/profit/margin/drawings/sustainable_draw).
- `byCategory` / `bySource` = grouped sums of the ledger (agency only; is_agency=true, treatment in revenue/opex/cost_of_sales).
- `liveSignals` (current-month, before the statement lands) = pull two things already in the OS:
  - **Agency ad spend:** `SELECT sum(spend) FROM agency_ads_daily WHERE date >= month AND date < next_month`. This is the agency's own house Meta spend (answers "we're running ads for the agency"). Show as a CAC/cost signal.
  - **$97 product revenue:** count/sum `ce_website_forms WHERE source='purescale_97_order'` in-month (see `app/api/paid-ads/route.ts`).
- `GET /api/finance/months` → list of months + status for the selector.
- `POST /api/finance/month/finalize` (owner) → set `status='final'`, recompute + freeze caches.
- (Later) `POST /api/finance/import` (owner) → accept categorized transactions JSON from the monthly import script (see Automation).

## UI — `app/(dashboard)/finance/page.tsx`
`'use client'`, `useEffect` → `fetch('/api/finance?month=...)`, follow the `app/(dashboard)/paid-ads/page.tsx` pattern. Components: `KpiCard` tiles + recharts.
- Month selector (defaults to latest).
- KPI tiles: **Revenue**, **Real costs**, **Operating profit**, **Operating margin %**, **Owner drawings**, **Sustainable monthly draw**. Make the profit-vs-drawings relationship explicit (e.g. a caption: "You can draw ~£X/mo without shrinking cash").
- Breakdown: costs by category (bar), revenue by source/client, and a **Flags** list (open items to resolve).
- **Live signals** panel: current-month agency ad spend (from `agency_ads_daily`) and $97 orders — labelled "live, pre-statement" to distinguish from the reconciled monthly P&L.
- Status badge (draft/final) + a "Finalize month" button (owner).

## Nav — `components/nav.tsx`
Add an owner-only category (or a "Finance" section) with `{ label: 'P&L', href: '/finance' }`. Import a Lucide icon (`PoundSterling` or `Wallet`). No filter code needed — `filterNav`/`canAccessPath` hide it from non-owners automatically. Verify by checking the nav does NOT render for a non-owner test email.

## Seed — June 2026 (final numbers)
Insert these into `finance_transactions` (month `2026-06-01`), then upsert the `finance_months` summary. Numbers are the reconciled final from `finance/june_2026_pnl.md`. Revenue £5,040 · real cost £2,401.77 · profit £2,638.23 (~52%) · drawings £3,500 · sustainable draw £2,638.

**Revenue (treatment=revenue, direction=in):**
- stripe · "Client retainer A (identify)" · 2400.00 · flag="identify which client"
- stripe · "Client retainer B (identify)" · 1440.00 · flag="identify which client"
- revolut_lillys · "DiSanti fee" · 1200.00 · client=DiSanti

**Cost of sales (treatment=opex, category=cost_of_sales):**
- stripe · "Stripe fees" · 88.72

**Team/contractors (treatment=opex):**
- tide · team · "Taij (media buyer)" · 708.00
- tide · contractors · "Wise (overseas contractor)" · 287.33
- tide · contractors · "Upwork" · 84.29
- revolut_lillys · contractors · "Gladys (VA)" · 132.00

**Acquisition tools (treatment=opex, category=acquisition_tools):**
- tide · "Apollo.io" · 81.52
- tide · "AIB2B (AI build → now £180/mo sub)" · 102.00 · notes="future: flat £180/mo"
- tide · "Instantly" · 36.44
- tide · "Beanstalk Consulting" · 14.74
- revolut_lillys · "AIB2B (AI build)" · 102.00
- revolut_lillys · "Whop (client acquisition)" · 72.21
- revolut_lillys · "Instantly" · 32.06 · notes="duplicate now cancelled on Lillys"
- revolut_lillys · "Million Verifier" · 29.00
- revolut_lillys · "Pre-warm Outlook" · 12.55

**Delivery/AI tools (treatment=opex, category=delivery_tools):**
- revolut_lillys · "Anthropic (Claude)" · 308.61
- tide · "TrendTrack" · 53.44
- tide · "Apify" · 35.60
- tide · "Webflow" · 26.12
- tide · "CapCut" · 21.99
- revolut_lillys · "Moonshot AI" · 3.93

**Overhead / regulatory (treatment=opex):**
- tide · overhead · "A1 Accountancy" · 80.00
- tide · regulatory · "ICO data-protection" · 47.00
- tide · overhead · "Virgin Media" · 34.00
- tide · overhead · "Tide fees" · 8.22

**Owner drawings (treatment=drawings, category=owner_drawings, direction=out):**
- tide · "Family payroll — Panimbo (0001)" · 350.00
- tide · "Family payroll — Ordonez (0003)" · 590.00
- tide · "Family payroll — Alvarez (0004)" · 410.00
- tide · "Family payroll — Ferreira (0005)" · 730.00
- tide · "Family payroll — Espinoza (0006)" · 360.00
- tide · "Family payroll — Aristizabal (0006-AM)" · 560.00
- tide · "Cash withdrawal" · 500.00

**Eliminated / excluded (not in agency P&L):**
- revolut_lillys · internal_transfer · treatment=eliminated · "Lilly's + Amour internal transfer" · 58.00
- revolut_lillys · store_excluded · treatment=excluded · is_agency=false · "Shopify store payouts (in)" · 1445.01 · direction=in
- revolut_lillys · store_excluded · treatment=excluded · is_agency=false · "Shopify store bill" · 189.22
- revolut_lillys · store_excluded · treatment=excluded · is_agency=false · "A1 (Lilly + house)" · 70.00
- revolut_lillys · store_excluded · treatment=excluded · is_agency=false · "GBP→EUR exchange" · 6.00
- revolut_lillys · store_excluded · treatment=excluded · "Stripe MOS (unclassified)" · 37.88 · flag="classify: Klaviyo/store or agency"
- revolut_lillys · overhead · treatment=opex · "Revolut plan fee" · 10.00 · flag="agency or store split"

`finance_months` for 2026-06: status='final', revenue_total=5040.00, cost_total=2401.77, operating_profit=2638.23, operating_margin=0.523, owner_drawings=3500.00, sustainable_draw=2638.23, narrative="June ~52% margin. Open flags: identify 2 Stripe clients; classify Lillys Stripe £37.88. Instantly duplicate cancelled. AIB2B now £180/mo sub."

## Automation (Phase 2 — separate, after July manual run)
The monthly import is a workspace script (in "AM Agency Workspace 2"), not OS code: `execution/build_monthly_pnl.py` takes the three exports (Tide PDF/CSV, Revolut/Lillys CSV, Stripe balance history CSV), categorizes with the rules in `agency-finance-structure` memory, and POSTs categorized rows to `POST /api/finance/import` (owner-gated). Keep manual for July to lock categories, then automate. Do NOT build the import script as part of this OS ticket.

## Definition of done
- [ ] `054_finance.sql` applied via `npm run migrate` (two tables).
- [ ] `requireOwner()` in `lib/access.ts`; every `/api/finance/*` returns 403 to non-owners (test with a non-owner session).
- [ ] `/finance` page renders June from seed; hidden from a non-owner test login (nav + direct URL both blocked).
- [ ] Live signals panel reads `agency_ads_daily` + `$97` orders for the current month.
- [ ] June shows £5,040 / ~£2,402 / £2,638 / ~52% / £3,500 draw / £2,638 sustainable.
- [ ] Ship: commit + push `main` (Vercel auto-deploys). Confirm live on augustosv3.vercel.app behind Seb's login.

## Related — agency ad account (going live Mon 28 Jul)
- **Business Manager ID: `1020754523930738`** (supplied by Seb).
- `agency_ads_daily` is fed by `app/api/cron/meta-sync` which needs the **ad account ID** (`act_…`), NOT the BM ID. The ad account is created *inside* the BM above; grab its `act_…` ID once it exists Monday.
- Set `AGENCY_META_AD_ACCOUNT_ID=act_…` in Vercel env → agency's own ad spend flows into `agency_ads_daily` daily and into the Finance live-signals panel automatically. No new ad tables needed.
- Ensure the meta-sync system user has `ads_read` on this new ad account (same grant issue that blocked client accounts in July — see august-os-v3 notes).
