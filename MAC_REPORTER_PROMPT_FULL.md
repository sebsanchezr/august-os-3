# Mac Reporter — Full Prompt (paste this entire block into Claude Code on the Mac)

---

You are building a standalone Python reporter service for August Marketing. It runs ONLY on this Mac (which has the Meta ad account API tokens and TrendTrak data). It writes to a shared Supabase database over the internet. A separate web app on another machine reads that same database and handles approvals. You never touch the web app — only Supabase.

Do NOT look for any other repo, plan file, or config on this machine. Everything you need is in this prompt. Build in a new `reporter/` directory inside this workspace. Locate and reuse any existing Meta/TrendTrak API client code already in this workspace — do not re-implement auth.

---

## ENVIRONMENT

Create a file at `reporter/.env` with exactly these values:

```
SUPABASE_URL=https://rdrrbbvhprjmpuosusca.supabase.co
SUPABASE_SERVICE_KEY=<your-supabase-service-role-key>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
NICK_THERIOT_CHANNEL_ID=UCWqjZ2W4pOOErFealWwBSXA
```

Load this `.env` at the top of every script with `python-dotenv` or `os.environ`.

---

## SUPABASE SCHEMA

These tables already exist. Do not create them. Just read and write.

**clients** — READ ONLY:
- `id` UUID, `name` TEXT, `status` TEXT (`active|paused|churned`)
- `meta_ad_account_id` TEXT — the `act_xxxx` ID. Skip this client entirely if null.
- `trendtrak_ids` TEXT[], `target_roas` NUMERIC, `target_cpa` NUMERIC
- `monthly_budget` NUMERIC, `currency` TEXT (default `GBP`)
- `contact_name` TEXT, `am_profile_id` UUID
- `call_day` SMALLINT (1=Mon..5=Fri), `call_time` TIME

**client_metrics_daily** — UPSERT on unique `(client_id, date)`:
- `client_id` UUID, `date` DATE
- `spend` NUMERIC, `revenue` NUMERIC, `roas` NUMERIC
- `purchases` INT, `cpa` NUMERIC, `impressions` BIGINT, `clicks` INT, `ctr` NUMERIC
- `top_creatives` JSONB — array of `{ad_id, name, spend, roas, thumbnail_url}`
- `competitor_notes` JSONB — TrendTrak highlights for that day

**client_reports** — INSERT drafts only. The web app handles approval and sending. Never set `approved_by`, `approved_at`, or `sent_at`.
- `client_id` UUID
- `type` TEXT — `weekly_eow | monday_kickoff | meeting_prep | meeting_followup | monthly_deep_dive`
- `period_start` DATE, `period_end` DATE
- `metrics` JSONB — frozen snapshot of the numbers you used when drafting
- `client_message` TEXT — the WA-ready text the client will see
- `draft_md` TEXT — the internal brief, shown only to the team
- `status` TEXT — always insert as `pending_approval`

**client_talking_points** — READ unconsumed (where `consumed_by_report IS NULL`), then mark consumed:
- `id` UUID, `client_id` UUID, `point` TEXT, `consumed_by_report` UUID

**client_meetings** — READ to find prep/followup candidates, UPDATE to set link fields:
- `id` UUID, `client_id` UUID, `type` TEXT, `scheduled_at` TIMESTAMPTZ
- `status` TEXT (`scheduled|done|cancelled`), `transcript_id` UUID
- `prep_report_id` UUID, `followup_report_id` UUID

**tasks** — READ open tasks per client. INSERT action items from meeting follow-ups:
- `id` UUID, `title` TEXT, `description` TEXT, `track` TEXT, `department` TEXT
- `client_id` UUID, `assignee_id` UUID, `status` TEXT, `priority` TEXT
- `due_date` DATE, `source` TEXT, `completed_at` TIMESTAMPTZ, `deleted_at` TIMESTAMPTZ, `archived_at` TIMESTAMPTZ
- Open tasks: `status NOT IN ('done','live') AND deleted_at IS NULL AND archived_at IS NULL`
- Completed this week: `completed_at` within last 7 days
- When inserting follow-up action items: `track='ops', department='client', status='backlog', source='meeting', priority='normal'`

**knowledge_base** — READ for suggestions context. Written by nick_theriot_agent.py and research_agent.py:
- `id` UUID, `source` TEXT (`nick_theriot|research|manual`)
- `source_ref` TEXT (YouTube video ID or research query key)
- `title` TEXT, `content` TEXT (full transcript or findings)
- `tags` TEXT[], `published_at` TIMESTAMPTZ, `ingested_at` TIMESTAMPTZ
- To read: `supabase.table("knowledge_base").select("*").eq("source","nick_theriot").order("published_at", desc=True).limit(5).execute()`

---

## FILES TO BUILD

### 1. `reporter/lib.py` — shared helpers

```python
# Load .env, create Supabase client (SUPABASE_URL + SUPABASE_SERVICE_KEY)
# meta_insights(ad_account_id, since, until) -> dict with:
#   spend, revenue, purchases, roas, cpa, impressions, clicks, ctr
#   top_creatives: [{ad_id, name, spend, roas, thumbnail_url}] sorted by spend desc
#   Reuse existing Meta API client already in this workspace — do not re-implement.
#
# trendtrak_highlights(trendtrak_ids, date) -> dict or string of competitor notes
#   Reuse existing TrendTrak client already in this workspace.
#
# draft_with_claude(system_prompt, data_payload) -> str
#   Calls claude-sonnet-4-6, temperature 0.4
#   HARD RULES for all output:
#     - UK English
#     - Warm but concise
#     - Absolutely no em-dashes (replace with commas or colons)
#     - Never invent numbers — every figure must come from data_payload
#     - If a figure is missing or None, omit that line entirely rather than guess
#
# load_knowledge_base(source, limit) -> list of dicts
#   Reads knowledge_base table filtered by source, ordered by published_at DESC
```

### 2. `reporter/metrics_sync.py` — daily 06:00

For each active client with `meta_ad_account_id`:
- Pull yesterday's metrics + top 3 creatives + TrendTrak notes
- UPSERT into `client_metrics_daily` on `(client_id, date)` — idempotent
- Support `--since YYYY-MM-DD` flag for backfilling a date range

### 3. `reporter/friday_report.py` — every Friday 12:00

For each active client with `meta_ad_account_id`:

**Data to gather:**
- Last 7 days and MTD metrics from `client_metrics_daily` (fetch live from Meta API if rows missing)
- Top 3 creatives by ROAS from the last 7 days
- TrendTrak competitor notes for the period
- Tasks completed this week (for this client)
- Open tasks (for this client)
- Unconsumed `client_talking_points` for this client
- Last 5 `knowledge_base` rows where `source='nick_theriot'`
- Last 3 `knowledge_base` rows where `source='research'`
- Client targets: `target_roas`, `target_cpa`, `monthly_budget`, `currency`
- Next `client_meetings` row with `status='scheduled'` (for next call date)

**Generate TWO artifacts via `draft_with_claude`:**

**(a) `client_message`** — the WA-ready text. Use EXACTLY this structure. Drop any section where there is no data:

```
Hey {contact_name first name only}, end of week update from the August team

This week
Spend: {spend} | Revenue: {revenue} | ROAS: {roas}x (target {target_roas}x) | CPA: {cpa}
{one sentence on what drove performance this week}

Winning creative
{top creative name} — {one line on why it is working}

Done this week
- {completed task or talking point}
- {completed task or talking point}

Next week
- {planned test or launch from open tasks/talking points}
- {planned test or launch}

Needs your input
- {any outstanding client-side actions, approvals, budget decisions — omit entire section if none}

Next call: {scheduled_at date and time if known}
Any questions before the weekend, just message here.
```

**(b) `draft_md`** — the internal brief. Shown only to Seb and the team. Structure:

```
## {client name} — Internal Brief {week ending date}

### Performance
- MTD spend: {mtd_spend} vs budget {monthly_budget} ({pct}% of month used, {pct}% of budget spent)
- 7-day ROAS: {avg_roas}x vs target {target_roas}x ({on track / below target / above target})
- 7-day CPA: {cpa} vs target {target_cpa}

### What we tested
{from talking points + completed tasks — what was launched or tested this week}

### What worked
{from creative performance data — which creative/audience/angle performed best and why}

### What didn't
{underperformers — specific creative or test that missed, and a hypothesis for why}

### Competitor intelligence
{TrendTrak notes — what are competitors running}

### Health flags
{anything concerning — flat ROAS, budget overspend, no contact logged, open issues}

### Suggestions for next week
{THIS IS THE BRAIN SECTION. Use the Nick Theriot transcripts and research findings as context.
Nick's core principles: broad targeting (no detailed audience targeting), CBO structure,
let the algorithm find buyers, creative is the main lever, Advantage+ placements, test new
angles weekly, kill losers fast, scale winners incrementally.

Write 3-5 specific actionable suggestions grounded in:
  1. This client's actual data (what's working, what's not)
  2. Nick's most recent thinking (quote or reference the transcript where relevant)
  3. Current Meta best practices from research

Each suggestion should be one sentence of action + one sentence of rationale.
Example format:
  - Launch 3 new creative angles targeting [specific hook] — Nick's most recent video
    shows broad + creative variation is outperforming interest-based targeting for ecom.}
```

**After generating both:**
- Insert one `client_reports` row: `type='weekly_eow'`, `status='pending_approval'`, `client_message` and `draft_md` set, `metrics` = frozen JSON of all numbers used, `period_start` / `period_end` = the 7-day window
- Set `consumed_by_report = report.id` on all talking points you used
- Do not send anything anywhere — the web app handles delivery

Support `--client UUID --dry-run` flag: prints both artifacts to stdout without inserting.

### 4. `reporter/monday_kickoff.py` — every Monday 07:30

Per active client: short week-ahead message from open tasks + next scheduled meeting.

```
Hey {first_name}, quick one from us to kick off the week.

This week we're working on:
- {open task 1}
- {open task 2}

Next call: {next meeting date/time if known}
Any questions, we're here.
```

Insert as `type='monday_kickoff'`, `status='pending_approval'`.

### 5. `reporter/meeting_prep.py` — hourly 08:00-18:00

Find `client_meetings` where:
- `status = 'scheduled'`
- `scheduled_at` is 20-28 hours from now
- `prep_report_id IS NULL`

For each: build a prep brief with performance since last meeting, open tasks, suggested agenda, open issues. Insert as `type='meeting_prep'`, `status='pending_approval'`. Update the meeting row: `prep_report_id = new_report.id`.

### 6. `reporter/post_meeting.py` — every 15 minutes

Find `client_meetings` where:
- `status = 'done'`
- `transcript_id IS NOT NULL`
- `followup_report_id IS NULL`

For each: read the transcript from `meeting_transcripts` (join on `transcript_id`), draft meeting minutes + action items. Insert action items as `tasks` rows (see schema above). Draft client follow-up WA message. Insert as `type='meeting_followup'`, `status='pending_approval'`. Update the meeting: `followup_report_id = new_report.id`.

### 7. `reporter/nick_theriot_agent.py` — daily 07:00

Builds and maintains a full transcript library from Nick Theriot's YouTube channel.

**TWO MODES:**

`--backfill`: Uses `yt-dlp` to list EVERY video on the channel (run once to build the full brain). Fetches transcript for each, stores in `knowledge_base`. Takes 30-60 min.

Default (daily): Checks RSS feed for videos in the last 7 days, ingests any not yet stored.

```python
# Auto-install: feedparser, youtube-transcript-api, yt-dlp
# Channel: NICK_THERIOT_CHANNEL_ID from env = UCWqjZ2W4pOOErFealWwBSXA
# RSS URL: https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}
# yt-dlp backfill URL: https://www.youtube.com/channel/{CHANNEL_ID}/videos
#
# For each video: pull transcript (prefer manual EN, fall back to auto-generated EN)
# Merge transcript entries into readable paragraphs (~12 lines per paragraph)
# Insert into knowledge_base:
#   source='nick_theriot', source_ref=video_id, title=video_title,
#   content=full_transcript, tags=['meta_ads','nick_theriot','creative','media_buying',
#   'going_broad','cbo','advantage_plus'], published_at=video_publish_date
# UNIQUE constraint on (source, source_ref) — skip already-ingested videos
# Sleep 1.5s between videos in backfill mode to be polite to YouTube
#
# --stats flag: print count and last 20 titles ingested
# --backfill flag: use yt-dlp playlist mode to get all videos
```

### 8. `reporter/research_agent.py` — every Monday 07:30

Searches for what's currently working in Meta ads, stores findings as knowledge base entries.

```python
# Queries to search weekly:
#   "Meta ads what's working {current month} media buyer"
#   "Facebook ads best practices {year} going broad"
#   "Nick Theriot Meta ads strategy tips"
#   "Advantage Plus Meta ads results {current month}"
#   "Meta ads creative testing strategy {current month}"
#
# Search: Brave Search API if BRAVE_SEARCH_API_KEY set, else DuckDuckGo instant API
# Synthesise: ask claude-sonnet-4-6 to extract 3-5 actionable bullet points per query
# Skip queries already researched this week (unique key = week_number:query[:50])
# Insert into knowledge_base:
#   source='research', source_ref='{week}:{query[:50]}',
#   title=f'Research: {query}', content=findings, tags=['meta_ads','research','weekly']
```

### 9. `reporter/setup_reporter_cron.sh` — installs all launchd jobs

```bash
# Load reporter/.env
# Install these launchd jobs (StartCalendarInterval, logs to logs/):
#
# com.august.reporter.metrics       daily 06:00      metrics_sync.py
# com.august.reporter.friday        Friday 12:00     friday_report.py
# com.august.reporter.monday        Monday 07:30     monday_kickoff.py
# com.august.reporter.prep          hourly 08:00-18  meeting_prep.py
# com.august.reporter.followup      every 15 min     post_meeting.py
# com.august.reporter.nick_theriot  daily 07:00      nick_theriot_agent.py
# com.august.reporter.research      Monday 07:30     research_agent.py
#
# Pass ALL env vars (SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
# NICK_THERIOT_CHANNEL_ID) through each plist EnvironmentVariables dict.
# Pattern: same as any existing launchd cron in this workspace.
```

---

## SEQUENCE — do these in order

**Step 1:** Find and confirm you can call the existing Meta API and TrendTrak clients in this workspace. Show me a sample output for one client's yesterday metrics before building anything.

**Step 2:** Build `reporter/lib.py`. Test `draft_with_claude` with a dummy payload.

**Step 3:** Build `reporter/metrics_sync.py`. Run `--since {14 days ago}` for ONE client. Show me the rows it upserted.

**Step 4:** Build `reporter/nick_theriot_agent.py`. Run `--backfill` to ingest the full archive. This runs unattended — tell me when done and show `--stats` output.

**Step 5:** Build `reporter/research_agent.py`. Run once and show what it stored.

**Step 6:** Build `reporter/friday_report.py`. Run `--client {client_id} --dry-run` for ONE client. Show me BOTH artifacts (client_message and draft_md) in full before inserting anything.

**Step 7:** Review and approve the dry-run output together. Then build the remaining scripts (monday_kickoff, meeting_prep, post_meeting) and the cron installer.

**Step 8:** Run `bash reporter/setup_reporter_cron.sh` to install all crons.

---

## ACTIVE CLIENTS (for reference)

These are the clients currently in the database. Use their IDs if you need to test with a specific client:

- L'alingi
- Liquidation Store
- Coffuel
- Lilly's Amsterdam
- Amour et Bijoux
- Disanti Studio

Fetch live from Supabase: `supabase.table("clients").select("id,name,meta_ad_account_id").eq("status","active").execute()`

---

## HARD RULES for all generated copy

- UK English throughout
- No em-dashes anywhere (use commas, colons, or rewrite the sentence)
- Never invent a number — if data is missing, omit the line
- Client-facing copy: warm, professional, concise — never more than one paragraph of narrative
- Internal copy: direct, analytical, no fluff — Seb reads this quickly on a Friday afternoon
