# ACCOUNTS BUILD PLAN (Account Management + Client Comms Automation)

Planned by Fable (strategy only). Built by cheaper models per Phase Assignments at the bottom.

---

## 0. Decision Summary

- New **Accounts** section in the OS under Fulfilment (`/accounts`), extending the existing `clients` table from `005_tasks.sql`. Tasks already link to clients via `client_id`, so account views get task rollups for free.
- **Supabase is the bridge between the two machines.** The Mac (which holds ad account API keys + TrendTrak) runs a nightly metrics sync and a Friday report generator, and writes results into Supabase. The laptop-side OS never touches ad platform keys.
- **Client comms stay on WhatsApp** (clients like it). We do not attempt to send into WA group chats programmatically in v1: the official WA Cloud API (Composio) cannot post to groups, and unofficial bridges (whatsapp-web.js) carry ban risk on the business number. Instead: every outbound client message is generated as a draft, approved by Seb, then delivered as **copy-paste-ready text in Discord** (plus optional Composio 1:1 WA DM to the account manager). AM forwards to the client group in ~5 seconds. Group-send automation is a Phase 4 option, explicitly flagged as risky.
- **Approval flow v1 happens in the OS** (approval queue page + Discord notification with a deep link). A Discord bot with Approve/Reject buttons is Phase 3, because the current Discord integration is webhook-only and buttons require a persistent bot process.
- Cadence engine encodes the Genflow model: **Daily = ad hoc, Weekly = Friday EOW update + weekly call, Monthly = strategic deep dive.** Plus Monday kick-off messages, 24h meeting prep, 30-minute post-meeting follow-ups.
- Runtime LLM for drafting client-facing copy: `claude-sonnet-4-6` (client-facing prose must be good). Metric crunching is plain Python, no LLM needed.

---

## 1. Research Summary: what world-class agency client management looks like

Distilled from the Genflow masterclass docs (Client Management Systems, Understanding Client Issues, Resolving Client Issues, Performance Issues) plus standard top-agency practice. These are the principles the system below encodes:

1. **One rulebook, zero personal styles.** Every AM runs the identical cadence and identical report format. Consistency is what scales from 1 to 70 clients. The OS enforces this by generating the artifacts (reports, prep docs, follow-ups) from templates rather than letting people freestyle.
2. **Three-tier cadence, strictly separated:**
   - **Daily:** ad hoc tactical comms in WA. Rule: every client message acknowledged same day (EOD sweep).
   - **Weekly:** structured Friday EOW update in a fixed format (performance summary, completed work, outstanding actions, next week's plan, commercial decisions, next meeting date). Prepared Friday after lunch, reviewed by manager, sent before the weekend so every client knows exactly where things stand.
   - **Monthly:** separate strategic deep dive: prior month review, next month goals/targets, financials, 3-month direction. Never let weekly calls drift into strategy.
3. **Rhythm rituals:** Monday-morning first message to every client (plan for the week, signals they are the priority). Meetings spaced through the week, never stacked. Prep completed 24h before every meeting. 30 minutes blocked immediately after every meeting to send minutes + actions while nuance is fresh.
4. **Money/trust issues are same-day and founder-handled.** Anything touching finances, reporting, or trust gets a response the same day, personally, with full transparency on the numbers. Slow responses make clients feel unheard, and unresolved small questions become churn.
5. **Early-warning detection.** Watch for trigger words ("confused", "disappointed", "frustrating"), tone shifts, delayed replies, engagement drops. Log them; proactively raise concerns ("I'm a bit worried something isn't quite right, let's talk").
6. **Issue resolution SOP:** classify the issue (financial/reporting, performance, execution quality, communication, process, client-side non-compliance, value-for-money, personality clash) → respond immediately → own it and apologise where appropriate → diagnose root cause → explain transparently → present a fix → assign team accountability → update the process so it never repeats → document.
7. **Founder QC without founder bottleneck.** The founder reviews outbound comms (approval layer) but does not write them. That's exactly the draft → approve → send pipeline.
8. **Reports must be reusable by the client internally.** Same structure every week, clean numbers, so the client's team can forward it up their chain. This builds the perception of value that prevents value-for-money churn.

Everything below is these 8 principles turned into schema, crons, and an approval pipeline.

---

## 2. Architecture (two machines, one database)

```
MAC (has ad account keys + TrendTrak)          LAPTOP / VERCEL (OS)
────────────────────────────────────           ─────────────────────────────
reporter/ scripts (launchd):                   cold_call_os Next.js app:
  metrics_sync.py   (nightly 06:00)  ──┐         /accounts pages
  friday_report.py  (Fri 12:00)      ──┤         /api/accounts/* routes
  meeting_prep.py   (hourly check)   ──┼──►  SUPABASE (shared source of truth)
  post_meeting.py   (on transcript)  ──┘         client_metrics_daily
                                                 client_reports (drafts)
        writes drafts + metrics                  client_meetings, issues, comms log
                                                       │
                                                       ▼
                                          Discord webhook: "report ready, approve here [link]"
                                                       │
                                          Seb approves in OS (/accounts/approvals)
                                                       │
                                          Approved copy posted to Discord #client-comms
                                          (+ optional Composio WA 1:1 DM to the AM)
                                                       │
                                          AM copy-pastes / forwards to client WA group
```

- The Mac authenticates to Supabase with the existing `SUPABASE_SERVICE_KEY` pattern (same as `lead_pipeline/scripts/tasks_digest.py`).
- Draft generation calls the Claude API (`claude-sonnet-4-6`) on the Mac, where the data lives.
- The OS is purely a viewer + approval surface + registry. No ad platform keys ever leave the Mac.

---

## 3. Database (migration `006_accounts.sql`)

### 3a. Extend existing `clients` table

```sql
ALTER TABLE clients
  ADD COLUMN contact_name        TEXT,
  ADD COLUMN contact_email       TEXT,
  ADD COLUMN wa_group_name       TEXT,            -- human label of the client WA group
  ADD COLUMN mrr                 NUMERIC,
  ADD COLUMN currency            TEXT DEFAULT 'GBP',
  ADD COLUMN start_date          DATE,
  ADD COLUMN renewal_date        DATE,
  ADD COLUMN am_profile_id       UUID REFERENCES profiles(id),   -- account owner
  ADD COLUMN meta_ad_account_id  TEXT,            -- act_xxxx, used by Mac reporter
  ADD COLUMN trendtrak_ids       TEXT[],          -- competitor tracking ids
  ADD COLUMN target_roas         NUMERIC,
  ADD COLUMN target_cpa          NUMERIC,
  ADD COLUMN monthly_budget      NUMERIC,
  ADD COLUMN call_day            SMALLINT,        -- 1=Mon..5=Fri, weekly call day
  ADD COLUMN call_time           TIME,
  ADD COLUMN health              TEXT NOT NULL DEFAULT 'green',  -- green|amber|red (computed, cached)
  ADD COLUMN last_client_contact TIMESTAMPTZ,     -- last inbound/outbound comm logged
  ADD COLUMN notes               TEXT;
```

### 3b. New tables

```sql
-- Daily per-client performance snapshot, written by the Mac
CREATE TABLE client_metrics_daily (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES clients(id),
  date         DATE NOT NULL,
  spend        NUMERIC, revenue NUMERIC, roas NUMERIC,
  purchases    INT, cpa NUMERIC, impressions BIGINT, clicks INT, ctr NUMERIC,
  top_creatives JSONB,        -- [{ad_id, name, spend, roas, thumbnail_url}]
  competitor_notes JSONB,     -- TrendTrak highlights for that day (optional)
  UNIQUE (client_id, date)
);

-- Every generated client-facing artifact goes through this table
CREATE TABLE client_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES clients(id),
  type         TEXT NOT NULL,   -- weekly_eow | monday_kickoff | meeting_prep | meeting_followup | monthly_deep_dive
  period_start DATE, period_end DATE,
  metrics      JSONB,           -- frozen numbers used in the draft
  draft_md     TEXT,            -- internal view (fuller, with flags/context for Seb)
  client_message TEXT,          -- the exact WA-ready text to forward
  status       TEXT NOT NULL DEFAULT 'pending_approval',
  -- pending_approval | approved | sent | rejected
  rejection_note TEXT,
  approved_by  UUID REFERENCES profiles(id),
  approved_at  TIMESTAMPTZ, sent_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weekly call + monthly deep dive scheduling
CREATE TABLE client_meetings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES clients(id),
  type         TEXT NOT NULL DEFAULT 'weekly',  -- weekly | monthly | adhoc
  scheduled_at TIMESTAMPTZ NOT NULL,
  agenda       TEXT,
  prep_report_id     UUID REFERENCES client_reports(id),
  transcript_id      UUID REFERENCES meeting_transcripts(id),
  followup_report_id UUID REFERENCES client_reports(id),
  status       TEXT NOT NULL DEFAULT 'scheduled' -- scheduled | done | cancelled
);

-- Comms log: powers health score + Genflow early-warning detection
CREATE TABLE client_comms_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id),
  direction   TEXT NOT NULL,        -- inbound | outbound
  channel     TEXT NOT NULL DEFAULT 'whatsapp',  -- whatsapp | email | call | meeting
  summary     TEXT NOT NULL,
  sentiment   TEXT DEFAULT 'neutral',  -- positive | neutral | concern
  flags       TEXT[] DEFAULT '{}',     -- trigger words: confused, disappointed, frustrating, cost_question, etc.
  logged_by   UUID REFERENCES profiles(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Issue tracker per the Genflow resolution SOP
CREATE TABLE client_issues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id),
  category    TEXT NOT NULL,
  -- financial_reporting | performance | execution_quality | communication |
  -- process | client_side | value_for_money | personality_clash
  severity    TEXT NOT NULL DEFAULT 'minor',  -- minor | major | trust_threatening
  description TEXT NOT NULL,
  root_cause  TEXT, resolution TEXT, process_fix TEXT,
  owner_profile_id UUID REFERENCES profiles(id),
  status      TEXT NOT NULL DEFAULT 'open',   -- open | resolving | resolved
  raised_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Talking points the team drops in during the week, consumed by Friday report
CREATE TABLE client_talking_points (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id),
  point      TEXT NOT NULL,
  added_by   UUID REFERENCES profiles(id),
  consumed_by_report UUID REFERENCES client_reports(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

RLS: same permissive `FOR ALL TO authenticated USING (true)` as existing tables.

**Health score rule (computed by nightly cron, cached on `clients.health`):**
- **red** if: any open `trust_threatening` issue, OR no client contact logged in 4+ business days, OR 7-day ROAS < 70% of target, OR any comms flag in last 7 days containing a trigger word.
- **amber** if: 7-day ROAS between 70 and 95% of target, OR open major issue, OR overdue client-linked tasks, OR no contact in 2-3 business days.
- **green** otherwise.

---

## 4. API routes (laptop, follow `/api/tasks` patterns exactly)

- `GET/POST /api/accounts` : list (with health, MRR, last contact, next meeting, 7d metrics rollup) / create client
- `GET/PATCH /api/accounts/[id]` : detail / update settings, targets, cadence
- `GET /api/accounts/[id]/timeline` : merged reports + meetings + issues + comms log
- `POST /api/accounts/[id]/comms` : log a comm (with sentiment + flags); updates `last_client_contact`; if flags present, fire Discord `notifyClientFlag`
- `POST /api/accounts/[id]/talking-points`
- `GET/POST/PATCH /api/accounts/issues[...]` : issue CRUD; raising a `trust_threatening` or `financial_reporting` issue fires an immediate Discord ping to Seb (Genflow: same-day, founder-handled)
- `GET /api/accounts/reports?status=pending_approval` : approval queue
- `POST /api/accounts/reports/[id]/approve` : sets approved, posts the `client_message` to Discord as copy-paste-ready text, optionally triggers Composio WA 1:1 DM to the AM (Phase 3)
- `POST /api/accounts/reports/[id]/reject` : with `rejection_note`; Mac reporter regenerates on next run or team edits inline
- `POST /api/agent/reports` : **inbound endpoint for the Mac** (auth via existing `AGENT_INBOUND_KEY` header pattern) to insert drafts + metrics. Alternatively the Mac writes to Supabase directly with the service key; support both, direct Supabase write is the default.

Discord additions in `lib/discord-notify.ts`: `notifyReportReady(report, client)` (with deep link to `/accounts/approvals`), `notifyClientFlag(client, flags)`, `notifyIssueRaised(issue, client)`, `notifyMeetingPrep(meeting, client)`, `notifyApprovedComms(client, message)` (posts the final WA-ready text).

Use a **new dedicated webhook** `DISCORD_ACCOUNTS_WEBHOOK_URL` pointing at a `#client-comms` channel so approvals do not drown in task noise.

---

## 5. UI (under Fulfilment in `nav.tsx`: "Accounts")

1. **`/accounts`** : client grid. Card per client: health traffic light, MRR, AM avatar, last contact ("2d ago"), next meeting, open tasks count, 7-day spend/ROAS sparkline vs target. Sort red → amber → green. This is the "can I see the whole agency's health in 5 seconds" view.
2. **`/accounts/[id]`** : client HQ. Header (health, MRR, targets, AM, cadence). Tabs:
   - **Overview**: 30-day metrics chart (from `client_metrics_daily`), top creatives this week, open tasks (existing tasks table filtered by client_id), open issues.
   - **Timeline**: reports, meetings, comms log, issues merged chronologically.
   - **Reports**: all generated reports with status.
   - **Settings**: targets, ad account id, TrendTrak ids, call day/time, contacts.
   Quick actions: "Log comm" (with sentiment + trigger-word flags), "Add talking point", "Raise issue".
3. **`/accounts/approvals`** : the queue. Each pending report shows the internal draft (context for Seb) and the exact client message, **editable inline before approving**. Approve / Reject buttons. This is the page Discord links to.
4. **`/accounts/issues`** : kanban by status, colored by severity, showing the Genflow category. Resolved issues require `root_cause` + `process_fix` filled in before closing (enforces "fix the process, not just the mistake").

---

## 6. Automation crons

### Mac side (launchd, new `reporter/` dir in august_os_v3, scripts mirror `lead_pipeline/scripts` conventions)

| Job | Schedule | What it does |
|---|---|---|
| `com.august.reporter.metrics` | Daily 06:00 | For each active client with `meta_ad_account_id`: pull yesterday's spend/revenue/ROAS/CPA/purchases + top 3 creatives by spend from Meta API, TrendTrak competitor highlights, upsert `client_metrics_daily`. |
| `com.august.reporter.friday` | Friday 12:00 | Per client: assemble 7d + MTD metrics, top winning creatives, TrendTrak notes, completed + open tasks (from `tasks` where client_id), unconsumed talking points → call Sonnet 4.6 to draft the EOW update (template below) → insert `client_reports` row (`weekly_eow`, pending_approval) → OS fires Discord notify. Genflow timing: drafted after lunch Friday, approved and forwarded same afternoon. |
| `com.august.reporter.monday` | Monday 07:30 | Per client: short Monday kick-off message draft ("plan for the week": this week's tasks, tests launching, meeting date) → `monday_kickoff` report → approval queue. Genflow: client hears from us first thing Monday. |
| `com.august.reporter.prep` | Hourly 08:00-18:00 | Any `client_meetings` 20-28h out without a prep report: generate prep brief (performance since last meeting, open actions, last report, suggested agenda, open issues) → `meeting_prep` report. Internal-only artifact: auto-approves to Discord for the AM, no client message. |
| `com.august.reporter.followup` | Every 15 min | Any `client_meetings` marked done with a linked transcript but no follow-up: draft minutes + action items → create tasks in `tasks` (client_id linked, assigned to AM) + draft client follow-up WA message → `meeting_followup` report → approval queue. Encodes the 30-minute post-meeting rule. |

### Laptop/existing-cron side (extend `lead_pipeline/scripts`)

| Job | Schedule | What it does |
|---|---|---|
| `com.august.accounts.health` | Nightly 05:30 | Recompute `clients.health` per the rule in section 3. Red transitions ping Discord immediately. |
| `com.august.accounts.eod_sweep` | Daily 17:30 | Discord nudge per AM: "EOD sweep: confirm all client WA messages answered today. Clients with no logged contact today: X, Y." Genflow daily fail-safe, kept manual-confirm since we cannot read WA groups. |
| `com.august.accounts.monthly` | 1st of month 07:00 | Trigger Mac-side monthly deep dive generation (prior month vs targets, next month goals, 3-month direction) → `monthly_deep_dive` report → approval queue. |

### The Friday EOW client message template (fixed format, every client, every week)

```
Hey {first_name}, end of week update from the August team 👇

📊 This week
Spend: {spend} | Revenue: {revenue} | ROAS: {roas} (target {target_roas}) | CPA: {cpa}
{one-line performance narrative: what drove it}

🏆 Winning creative
{top creative name + one line on why it's winning}

✅ Done this week
- {completed items from tasks + talking points}

🔜 Next week
- {planned tests/launches/tasks}

⚠️ Needs your input
- {outstanding client-side actions, approvals, budget decisions. Omit section if none}

📅 Next call: {meeting date/time}
Any questions before the weekend, just message here.
```

The internal `draft_md` shown to Seb additionally contains: MTD vs budget pacing, competitor moves from TrendTrak, any health flags, and anything the model hedged on, so approval is an informed 30-second read.

---

## 7. Prompt for the Mac side (paste into Claude Code on the Mac)

````
You are building the "reporter" service for August OS inside the existing repo. Read
cold_call_os/ACCOUNTS_BUILD_PLAN.md sections 2, 3, 6 first; you are implementing the
Mac-side column of that plan. Migration 006_accounts.sql already exists in Supabase.

Context you have on this machine: Meta ad account API access + tokens for all client
ad accounts, TrendTrak API access for competitor data, and env vars for Supabase
(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY) and ANTHROPIC_API_KEY. Locate the
existing ad-account/TrendTrak client code in this repo and reuse it; do not re-implement auth.

Build, in a new top-level reporter/ directory, following the conventions of
lead_pipeline/scripts (python, service-key Supabase writes, launchd install script,
logs to logs/):

1. reporter/lib.py: shared helpers. Supabase client, Meta insights fetch (spend,
   revenue, purchases, ROAS, CPA, impressions, clicks per ad account per date range,
   plus top-N ads by spend with name + ROAS + thumbnail), TrendTrak highlights fetch,
   and a draft_with_claude(prompt, data) helper calling model claude-sonnet-4-6 with
   temperature 0.4. All client-facing copy: UK English, warm but concise, no em-dashes
   anywhere (hard company rule), no invented numbers (every figure must come from the
   data payload, else omit).

2. reporter/metrics_sync.py: daily. For each active client in clients with a
   meta_ad_account_id, pull yesterday's metrics + top 3 creatives + TrendTrak notes,
   upsert into client_metrics_daily. Idempotent on (client_id, date). Backfill flag
   --since YYYY-MM-DD for first run.

3. reporter/friday_report.py: per active client, assemble: last 7 days + MTD from
   client_metrics_daily (fetch live from Meta if rows missing), top creatives, completed
   tasks this week and open tasks (tasks table, client_id), unconsumed
   client_talking_points, targets from clients row. Generate two artifacts with Claude:
   (a) client_message using EXACTLY the EOW template in ACCOUNTS_BUILD_PLAN.md section 6,
   (b) draft_md internal brief (MTD pacing vs monthly_budget, TrendTrak competitor moves,
   flags, anything uncertain). Insert into client_reports as type weekly_eow,
   status pending_approval. Mark talking points consumed. Never send anything anywhere:
   drafts only, the OS handles approval and delivery.

4. reporter/monday_kickoff.py: short week-ahead message per client from open tasks +
   next meeting, type monday_kickoff, pending_approval.

5. reporter/meeting_prep.py and reporter/post_meeting.py per the plan's cron table:
   prep briefs for meetings 20-28h out; follow-ups for done meetings with transcripts
   (create action-item tasks via Supabase insert into tasks with client_id + assignee
   = client's am_profile_id, and a client follow-up message to the approval queue).

6. reporter/setup_reporter_cron.sh: launchd install for the five jobs at the schedules
   in the plan (metrics 06:00 daily, friday 12:00 Fri, monday 07:30 Mon, prep hourly
   08-18, followup every 15 min), same install_job pattern as
   lead_pipeline/scripts/setup_tasks_cron.sh, logs to logs/com.august.reporter.*.log.

Testing before installing crons: run metrics_sync with --since for a 14-day backfill on
one client, then friday_report --client <id> --dry-run printing both artifacts to stdout.
Show me the dry-run output for approval before wiring launchd.
````

---

## 8. Phase assignments

| Phase | Scope | Where | Model |
|---|---|---|---|
| **1. Accounts tab** | Migration 006, API routes, `/accounts` pages, nav entry, Discord notify functions, health cron + EOD sweep cron | Laptop, `cold_call_os` + `lead_pipeline/scripts` | **Sonnet 4.6** |
| **2. Reporter** | `reporter/` scripts + launchd on the Mac (prompt in section 7), approvals queue wiring end-to-end, Friday/Monday/prep/followup pipelines | Mac | **Sonnet 4.6** |
| **3. Comms polish** | Composio WA 1:1 DM of approved messages to the AM, Discord bot with Approve/Reject buttons (persistent process via launchd), monthly deep dive generator | Both | **Sonnet 4.6** (bot), **Haiku 4.5** for small fixes |
| **4. Optional, flagged risky** | Direct WA group send via whatsapp-web.js bridge on the Mac (unofficial API, ban risk on the business number). Only if copy-paste friction actually proves annoying. | Mac | decide later |

Build order within Phase 1: migration → API → UI → crons (schema first, house rule).

**BLOCKING ITEMS (Seb, ~20 min total):**
- Create `#client-comms` Discord channel + webhook, set `DISCORD_ACCOUNTS_WEBHOOK_URL` in Vercel env and launchd plists.
- Fill per-client settings once the tab exists: `meta_ad_account_id`, targets, MRR, AM, call day/time, TrendTrak ids. The reporter skips clients missing an ad account id.
- Confirm `ANTHROPIC_API_KEY` is available on the Mac for the reporter.
- Decide meeting transcript source (Fireflies/Granola export vs manual paste into `meeting_transcripts`); the follow-up pipeline needs one.
