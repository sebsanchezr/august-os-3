# ONBOARDING BUILD PLAN (World-Class Client Onboarding + First-Week Wins)

Planned by Fable + confirmed with Seb (strategy locked). Built by cheaper models per Phase Assignments at the bottom. Do not deviate from the state machine or the "signed unlocks portal / paid gates launch" rule without asking Seb.

---

## 0. Decision Summary (LOCKED)

- **One click starts the machine.** In `/sales`, marking a deal Closed Won reveals a **Start Onboarding** button. Clicking it creates the onboarding record, the Stripe Customer, sends the contract (SignWell) and the first invoice (Stripe), and posts to Discord. Everything after is automated by webhooks and crons.
- **Fee billed every 30 days, starting before launch (updated 2026-07-06).** The contract's Start Date is the date the Client's campaigns go live — an event, not a date chosen at signing time. The first 30-day payment is invoiced up front (at Start Onboarding) and due before launch; every subsequent 30-day period bills again from the Start Date onward. **All fees are non-refundable.** Stripe flow: create Customer (from deal data) → Invoice Item for one 30-day Fee → Invoice → finalize → Stripe emails hosted invoice. Customer is created at Start Onboarding so the client profile persists for all future billing.
- **Recurring billing stays manual for now — a reminder, not automation (decided 2026-07-06).** Seb will raise each 30-day invoice by hand. `GET/POST /api/cron/invoice-reminders` runs daily via Vercel Cron (`vercel.json`), reads every active client's `clients.start_date` (set at launch), and on each exact 30-day anniversary creates a high-priority Task (`source: 'recurring'`, department `admin`, due today, client-linked) plus a Discord ping via `notifyInvoiceDue`. Idempotent per client per day. If automated recurring billing (Stripe Subscription or auto-invoice) is wanted later, this cron is the natural place to trigger it instead of just reminding.
- **One master contract** (SignWell template) + a per-engagement Schedule appendix (service, deliverables, fee) merged from deal data. Template drafted in `onboarding_assets/MASTER_SERVICES_AGREEMENT_TEMPLATE.md`.
- **Portal unlocks on `signed` only.** Momentum never waits on the client's finance team. **Payment is a gate on LAUNCH, not on the portal.** A client cannot be flipped to `launched` / handed to `/accounts` until `paid = true`.
- **One Kickoff Call, held early** (right after the onboarding form is submitted). It merges the old pre-onboarding strategy call and the Genflow kickoff call. No separate launch call; going live is a celebratory async moment that starts the first-week wins engine and the `/accounts` weekly cadence.
- **First-Week Wins Engine.** Days 1-7 post-launch, a daily agent finds one specific, positive, shareable win per client and drafts a WhatsApp-ready message into the existing approval queue. Rule: the client hears something positive and specific every day of week one.
- **Reuse everything.** `clients` table (006), Tasks (005), meetings/comms engine (009), sales transcripts (011), Discord webhooks, Resend (already wired in `app/api/.../route.ts`), approval-queue + draft→approve→send pattern (accounts build). Runtime LLM for drafting = `claude-sonnet-4-6`; internal brief + wins reasoning may use Opus where quality matters. No LLM for state transitions.

### Dependencies — AS BUILT: no new npm packages
Phases 1-3 were built with plain `fetch` wrappers (`lib/stripe.ts`, `lib/signwell.ts`) instead of official SDKs, matching this codebase's existing convention of raw REST calls for Resend, Discord, and Cal.com. Both APIs are plain REST/JSON, so this avoids an npm install and an extra dependency surface for two integrations this simple. Revisit only if a future phase needs SDK-only functionality (e.g. Stripe's typed webhook event objects).

### Env vars (add to Vercel + `.env.local`) — AS BUILT
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=                   # from the Stripe Dashboard webhook endpoint for invoice.paid
SIGNWELL_API_KEY=                        # used in the X-Api-Key header to send documents
SIGNWELL_TEMPLATE_ID=                    # the master MSA template once created in SignWell
SIGNWELL_WEBHOOK_ID=                     # returned when the webhook is registered; used as the HMAC secret to verify inbound events
SIGNWELL_TEST_MODE=                      # 'true' while testing, unset in production
DISCORD_ONBOARDING_WEBHOOK_URL=          # falls back to DISCORD_ACCOUNTS_WEBHOOK_URL if unset
NEXT_PUBLIC_ONBOARDING_PORTAL_BASE_URL=  # e.g. https://os.augustmarketing.co.uk (client + server both read this)
NEXT_PUBLIC_CAL_KICKOFF_EVENT_URL=       # Cal.com kickoff event type booking page URL
NEXT_PUBLIC_VSL_EMBED_URL=               # unlisted Loom/Vimeo embed URL for the welcome video
RESEND_API_KEY=                          # reuse existing if already set
RESEND_FROM_EMAIL=                       # reuse existing if already set
CRON_SECRET=                             # optional; if set, /api/cron/* checks it against the Authorization header Vercel Cron sends
```
Note: switched from Dropbox Sign to SignWell (2026-07-06) — Dropbox Sign requires a paid plan to send *any* real signature request via API, template or not, and Google has no eSignature API at all (Docs eSignature is UI-only, no send/webhook capability). SignWell is pay-as-you-go (25 free docs/month, then per-document) with templates and webhooks on every tier. Verification differs from the original Dropbox Sign plan: SignWell HMACs `event.type + "@" + event.time` using the **webhook's own ID** (returned when you register the webhook) as the secret, compared against `event.hash` — not the API key.

There is no `/api/onboarding/portal/[token]` GET route — the welcome page (`app/welcome/[token]/page.tsx`) is a server component that queries Supabase directly, since it needs no client-side fetch for the initial load.

**Manual setup still needed before this goes live (non-code):**
1. Create the SignWell template from `onboarding_assets/MASTER_SERVICES_AGREEMENT_TEMPLATE.md` (after solicitor review) and set each `{{merge_field}}` as a template field with a matching `api_id` (see the doc's field list). Note the template ID. Register the webhook via the SignWell API or dashboard for the `document_completed` event pointing at `/api/webhooks/signwell`, and save the returned webhook ID as `SIGNWELL_WEBHOOK_ID`.
2. Register the Stripe webhook endpoint (`/api/webhooks/stripe`) for the `invoice.paid` event and copy the signing secret.
3. In the Cal.com kickoff event type, add a hidden booking field named `onboardingId` (and ideally `name`/`email` prefill) so the webhook can link a booking back to the right onboarding record — see `extractOnboardingId` in `app/api/webhooks/cal/route.ts`.
4. Film the VSL and host it unlisted; set `NEXT_PUBLIC_VSL_EMBED_URL`.

---

## 1. State Machine

`onboardings.status` enum, strictly ordered. Transitions are triggered by webhooks/crons/user actions, never by an LLM.

```
won
  → contract_sent      (Start Onboarding clicked: Stripe customer + invoice + SignWell sent)
  → signed             (SignWell webhook: document_completed)  ── PORTAL UNLOCKS HERE
  → form_completed     (client submits onboarding form on /welcome/[token])
  → kickoff_booked     (Cal.com booking webhook OR manual mark)
  → kickoff_held       (meeting engine marks meeting complete)
  → building           (team marks build started; launch checklist created)
  → launched           (launch checklist complete AND paid=true) ── FLIPS TO /accounts, starts wins engine
  → handed_off         (account manager assigned, cadence engine owns the client)
```

Parallel booleans tracked independently of status (do not block portal):
- `contract_signed_at TIMESTAMPTZ`
- `invoice_paid_at TIMESTAMPTZ`  → sets `paid = true`; **required before `launched`**
- `form_completed_at`, `kickoff_at`, `launched_at`

Guard: the API route that sets `launched` must reject if `invoice_paid_at IS NULL`. Surface a clear "Invoice unpaid — cannot launch" state in the UI with a "Resend invoice" action.

---

## 2. Database — migration `012_onboarding.sql`

```sql
-- Onboarding state machine + forms + task templates + wins

CREATE TABLE IF NOT EXISTS onboardings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID REFERENCES pipeline_deals(id) ON DELETE SET NULL,  -- from 010_pipeline
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,         -- created at signed
  company_name        TEXT NOT NULL,
  contact_name        TEXT,
  contact_email       TEXT NOT NULL,
  service             TEXT NOT NULL,          -- drives task template + schedule
  deliverables        TEXT,                   -- added in 013_onboarding_deliverables.sql; merges into contract Schedule 1
  fee_amount          NUMERIC NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'GBP',
  status              TEXT NOT NULL DEFAULT 'won',
  portal_token        TEXT UNIQUE NOT NULL,   -- random, tokenizes /welcome/[token]

  -- external refs
  stripe_customer_id  TEXT,
  stripe_invoice_id   TEXT,
  stripe_invoice_url  TEXT,
  esign_document_id TEXT,

  -- timestamps that track parallel booleans
  contract_sent_at    TIMESTAMPTZ,
  contract_signed_at  TIMESTAMPTZ,
  invoice_sent_at     TIMESTAMPTZ,
  invoice_paid_at     TIMESTAMPTZ,
  portal_opened_at    TIMESTAMPTZ,
  form_completed_at   TIMESTAMPTZ,
  kickoff_at          TIMESTAMPTZ,
  launched_at         TIMESTAMPTZ,
  handed_off_at       TIMESTAMPTZ,

  paid                BOOLEAN NOT NULL DEFAULT FALSE,
  health              TEXT NOT NULL DEFAULT 'green',  -- green|amber|red, from onboarding health cron
  internal_brief      TEXT,                    -- AI-generated from transcript + form
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_forms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id   UUID NOT NULL REFERENCES onboardings(id) ON DELETE CASCADE,
  -- structured client inputs collected on the welcome page
  business_overview   TEXT,
  target_audience     TEXT,
  brand_guidelines_url TEXT,
  asset_links         TEXT,          -- Dropbox/Drive of content assets
  access_notes        TEXT,          -- FB Business Manager, ad accounts, logins to grant
  goals               TEXT,
  primary_contact     TEXT,
  billing_contact     TEXT,
  timezone            TEXT,
  extra               JSONB DEFAULT '{}',   -- service-specific fields
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_task_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service     TEXT NOT NULL,          -- match onboardings.service
  title       TEXT NOT NULL,
  description TEXT,
  owner_role  TEXT,                   -- maps to a profile role, resolved at instantiation
  offset_days SMALLINT DEFAULT 0,     -- due date = trigger date + offset
  phase       TEXT,                   -- 'pre_kickoff' | 'build' | 'launch'
  sort        SMALLINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS client_wins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  onboarding_id UUID REFERENCES onboardings(id) ON DELETE SET NULL,
  win_text      TEXT NOT NULL,        -- the specific, shareable win
  source        TEXT,                 -- 'metrics' | 'task' | 'comms' | 'manual'
  day_index     SMALLINT,             -- 1..7 of first week
  draft_message TEXT,                 -- WhatsApp-ready copy for approval queue
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft|approved|sent|skipped
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboardings_status ON onboardings(status);
CREATE INDEX IF NOT EXISTS idx_onboardings_token ON onboardings(portal_token);
CREATE INDEX IF NOT EXISTS idx_client_wins_client ON client_wins(client_id);
```

Also add `onboarding_id UUID REFERENCES onboardings(id)` to `clients` for backlink (nullable).

---

## 3. Routes & Pages

### OS (authenticated)
- `/onboarding` — pipeline board, columns = status stages, cards = clients in flight. Health dots. Click → slide-over.
- `/onboarding/[id]` slide-over — timeline of the state machine, external links (Stripe invoice, SignWell, portal link to copy), internal brief, form responses, task rollup, "Resend invoice", "Mark launched" (disabled until paid), "Hand off to Accounts".
- Dashboard tile: onboardings in flight + any red-health (stalled) onboardings.

### API
- `POST /api/onboarding/start` — from `/sales`. Creates onboarding row + portal_token, Stripe Customer + Invoice (finalize+send), SignWell request from template with merge fields, Resend welcome-pending email, Discord ping. Sets status `contract_sent`.
- `POST /api/webhooks/signwell` — verify event hash; on `document_completed` set `signed`, create `clients` row, generate internal brief (queue agent), send welcome email with portal link, Discord ping.
- `POST /api/webhooks/stripe` — verify signature; on `invoice.paid` set `invoice_paid_at` + `paid=true`, Discord ping.
- `POST /api/webhooks/cal` (or reuse existing meetings booking hook) — on kickoff booking set `kickoff_booked` + create meeting via 009 engine.
- `POST /api/onboarding/[id]/form` — public (token-guarded), writes `onboarding_forms`, sets `form_completed`, creates pre_kickoff tasks, drafts KO prep.
- `POST /api/onboarding/[id]/launch` — guarded on `paid`; completes launch, flips to `/accounts`, seeds wins engine.

### Public (no auth, token-guarded)
- `/welcome/[token]` — the VSL welcome portal. Server-fetch onboarding by token. Renders hero (client first name), VSL embed, 14-day roadmap, embedded onboarding form, Cal.com kickoff embed. 404 on bad/expired token.

---

## 4. Agents (draft → approve → send, per accounts pattern)

- `agents/08_onboarding_brief/` — trigger: onboarding reaches `signed`. Inputs: sales call transcript (011 `sales_calls`), deal data, service. Output: `onboardings.internal_brief` (who the client is, what was sold, context, risks, suggested initial strategy) as the internal kickoff pre-read. Model: Opus (context-heavy, quality matters).
- `agents/09_small_wins/` — cron daily 08:00. For each client with `launched_at` within last 7 days: scan `client_metrics_daily`, completed tasks, `client_comms_log` for a specific positive signal; write a `client_wins` row with `draft_message` into the approval queue; Discord ping "Win ready to send for {client}". If nothing found, still draft a light proactive check-in so the daily-touch rule holds. Model: Sonnet.
- Onboarding health cron (plain Python, no LLM): amber if signed→form gap > 3 days or form→kickoff gap > 4 days or unpaid > 7 days after invoice; red if any gap doubles. Writes `onboardings.health`, Discord alert on red.

---

## 5. Client-facing copy (ready to use)

- **VSL page copy + 2-min script**: in `onboarding_assets/WELCOME_VSL_SCRIPT.md` (film the generic "welcome to August" version this week; page supplies personalization).
- **Kickoff follow-up email**: reuse the Genflow template from `Client Kick Off Call.md` — deck attached, "What's Needed From You" + "August Next Steps" bullets with deadlines. AI-drafted into approval queue after `kickoff_held`, you approve, Resend sends.

---

## 6. Phase Assignments (hand to build models in order)

1. **Phase 1 — Sonnet:** `012_onboarding.sql`, `/onboarding` board + slide-over, state-machine helper lib. No external calls yet (manual status buttons to prove the flow).
2. **Phase 2 — Sonnet:** `POST /api/onboarding/start` + Stripe Customer/Invoice + SignWell send + webhooks (`signwell`, `stripe`). This removes the biggest manual pain. No new deps — plain fetch wrappers.
3. **Phase 3 — Sonnet:** `/welcome/[token]` portal, embedded onboarding form, Cal.com embed, welcome emails via Resend, magic-moment trigger on `signed`.
4. **Phase 4 — Opus:** `agents/08_onboarding_brief` + kickoff follow-up email drafting into approval queue.
5. **Phase 5 — Haiku:** `onboarding_task_templates` seed data per service, launch checklist, `POST /api/onboarding/[id]/launch` handoff to `/accounts`.
6. **Phase 6 — Opus:** `agents/09_small_wins` + onboarding health cron + dashboard tile.

---

## 7. Open items for Seb (non-blocking)
- Provide the Cal.com kickoff event link and the VSL embed URL when filmed.
- Confirm which services need distinct task templates (e.g. Paid Ads, Web, Social) so Phase 5 can seed them.
- Have the master contract reviewed by a UK solicitor before first live send (see disclaimer in the template file).
```
