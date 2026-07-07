# August OS: Sales Calls Build Plan

Planned by Opus. Executed by Sonnet/Haiku per the phase assignments at the bottom.
Do not deviate from this spec without flagging to Seb first.

Hard rule: no em-dashes anywhere in code comments, UI copy, notifications, or client-facing text.

Source SOPs: the four Genflow sales-call lessons (Sales Call Framework, Sales Call Strategy, Sales Call Framework (1), Most Valuable Pitch deck). The two-call framework and the MVP deck framework are encoded into the system below so the team runs the same play every time and the OS learns from every call.

---

## 1. Decision Summary

- We have a high close rate but no framework and no record. This build gives sales calls the same treatment cold calling, meetings, and accounts already have: a tracked lifecycle, a written SOP the team is trained on, and a learning loop off every transcript.
- Sales calls attach to `pipeline_deals`, not `clients`. A prospect becomes a client only after they sign. The sales call is the `showed -> proposal -> won` stretch of the pipeline we already have. No new prospect entity, we extend the pipeline.
- The framework is two calls. Call 1 is discovery and value (no price). Call 2 is offer, pricing, timeline, close. Plus a follow-up deck between them and an onboarding handoff after. Every call type is a first-class row so we can score each one on its own rubric.
- Transcript first, video optional. Seb takes every sales call on Google Meet and the transcript lands in the SAME Drive folder agent 06 already polls, mixed in with client meeting transcripts. The transcript is the artifact we keep and learn from; a recording URL is just an optional link field. Because the folder is shared, the system must decide whether a new transcript is a sales call or a client meeting before it does anything with it. That classification is the crux of this build, see section 5a.
- The schedule is the source of truth. Seb books the sales call in the OS first (prospect added as a pipeline_deal, a sales_calls row scheduled for the slot). When the transcript appears, we match it to that scheduled row by company name plus time window. No scheduled sales call to match means it is treated as a client meeting (agent 06's existing behaviour), so we never misfile.
- One analysis pass per call. Transcript in, Claude scores the call against the SOP rubric, returns strengths, improvements, objections faced, and an outcome read. The team reviews it in the OS. Over time the aggregate tells us which parts of the framework we win and lose on.
- AI stays where it already lives. The OS does not call Claude today (no SDK in package.json, deliberate). Analysis runs in a Python agent (07_sales_call_analyst) that reuses the agent 06 Drive + Anthropic + Supabase scaffolding and writes results back. The OS displays and lets Seb trigger a re-run. See section 5 for the one dependency question.
- The framework gets published as two /sop pages built from the lessons, so the team sells the same way the system scores.

## 2. Database (migration 011_sales_calls.sql)

Follow the conventions in 010_pipeline.sql and 006_accounts.sql (RLS: FOR ALL TO authenticated USING (true); updated_at trigger reuses update_updated_at_column from 001_initial.sql).

### sales_calls (new table)
- id                uuid PK default gen_random_uuid()
- deal_id           uuid not null references pipeline_deals(id) on delete cascade
- call_type         text not null default 'discovery'
    check (call_type in ('discovery','pitch','followup','onboarding'))
    -- discovery = call 1 (value, no price); pitch = call 2 (offer, price, close);
    -- followup = between-call touch; onboarding = post-signature handoff
- sequence          int not null default 1        (1st, 2nd call in the deal, for ordering)
- status            text not null default 'scheduled'
    check (status in ('scheduled','held','analyzed','no_show','cancelled'))
- scheduled_at      timestamptz
- held_at           timestamptz
- duration_minutes  int
- owner_profile_id  uuid references profiles(id) on delete set null   (who ran the call)
- recording_url     text            (optional Meet/Loom video link)
- deck_url          text            (the MVP deck sent for this deal)
- transcript        text            (raw transcript, pasted or Drive-ingested)
- transcript_source text default 'manual' check (transcript_source in ('manual','drive'))
- drive_file_id     text unique     (set when ingested from Drive, keeps agent idempotent; null for manual)
- analysis          jsonb           (see shape below; null until analyzed)
- outcome           text            check (outcome in ('advanced','stalled','won','lost','rebook'))
- next_step         text
- next_step_due     date
- notes             text            (human notes, separate from AI analysis)
- created_at        timestamptz default now()
- updated_at        timestamptz default now()

Indexes: idx_sales_calls_deal (deal_id), idx_sales_calls_status (status), idx_sales_calls_owner (owner_profile_id), idx_sales_calls_scheduled (scheduled_at).

### analysis jsonb shape (documented in a comment on the column and mirrored in lib/types.ts)
```
{
  "call_type": "discovery",
  "overall_score": 1-10,
  "dimensions": [
    { "key": "rapport", "score": 1-5, "note": "..." },
    ...
  ],
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "objections": [ { "objection": "...", "handled_well": true, "note": "..." } ],
  "outcome_read": "advanced | stalled | at_risk | likely_close",
  "summary": "2-3 sentence read of the call",
  "sop_gaps": ["framework steps that were skipped"]
}
```

### Rubric dimensions (constants in lib/sales-rubric.ts, also the SOP checklist)
Discovery (call 1): rapport, research_shown, problem_clarity, value_first, deck_as_guide, engagement_read, next_step_locked.
Pitch (call 2): recap_warmup, feedback_gauge, tailored_solution, roi_linked_price, objection_handling, clear_timeline, next_step_sent.
Only the dimensions for the call's type are scored. The analyst agent is handed the relevant list.

### pipeline_deals (no schema change)
We reuse the existing stages. Convention, enforced in the API not the DB:
- booking a discovery call -> stage stays 'booked'; on held -> 'showed'
- pitch call held -> 'proposal'
- outcome 'won' -> 'won' (then the existing deal->client convert flow); outcome 'lost' -> 'lost'

## 3. API routes (app/api/sales-calls)

Mirror the meetings routes (createSupabaseAdmin, JSON body guards, allowed-field PATCH).

- GET  /api/sales-calls
    List with filters: deal_id, status, owner, call_type, from, to. Joins pipeline_deals(prospect_name, company, stage) and profiles(name). Default order scheduled_at desc, limit 100.
- POST /api/sales-calls
    Create a call. Requires deal_id. Defaults call_type 'discovery', status 'scheduled', sequence = (max sequence for deal) + 1.
- GET  /api/sales-calls/[id]
    Single call with deal + owner joined.
- PATCH /api/sales-calls/[id]
    Allowed fields: status, call_type, scheduled_at, held_at, duration_minutes, owner_profile_id, recording_url, deck_url, transcript, outcome, next_step, next_step_due, notes.
    Side effects: setting status='held' stamps held_at and advances the deal stage per section 2. Setting outcome writes deal stage (won/lost) and, on 'won', posts notifyDealWon (already exists in discord-notify).
- POST /api/sales-calls/[id]/request-analysis
    Marks the call ready for analysis. In agent mode this just sets a flag/updated_at the poller keys off. In in-OS mode (section 5 option B) this is the route that calls Claude directly. Returns 202.
- DELETE /api/sales-calls/[id]
    Soft delete not needed, hard delete is fine (cascade is on deal, not here).

Add sales-calls-client.ts in lib mirroring pipeline-client.ts (fetchers + mutations the pages call).

## 4. UI

### Nav (components/nav.tsx)
Add a new section under the Acquisition category, after 'linkedin':
```
{ id: 'sales', label: 'Sales', items: [
    { label: 'Sales Calls', href: '/sales',          icon: PhoneCall },
    { label: 'Insights',    href: '/sales/insights',  icon: TrendingUp },
] }
```
Import PhoneCall from lucide-react (Phone is already imported). Sales sits between LinkedIn and the Fulfilment divider because it converts acquisition into clients.

### /sales (app/(dashboard)/sales/page.tsx)
List/table of sales calls, house style (bg #08090c, cards #10121a, borders #1c2035), reuse the call-table.tsx and pipeline-board.tsx visual language.
- Columns: prospect (company), call type badge, owner, scheduled/held, status, overall score (from analysis, dash if none), outcome.
- Filters across the top: status, call_type, owner.
- Row click opens the detail slide-over.
- Primary action: "Log sales call" opens a drawer (new component components/sales/log-sales-call-drawer.tsx, modeled on log-call-drawer.tsx). Fields: deal (searchable select of pipeline_deals, or quick-create prospect), call type, held date, duration, owner, recording URL, deck URL, paste transcript, outcome, next step. Saving inserts the row (status 'held' if transcript pasted) and triggers request-analysis.

### /sales/[id] detail (slide-over, components/sales/sales-call-detail.tsx)
Modeled on task-detail.tsx / meeting-slide-over.tsx.
- Header: prospect + company, call type, status, deal stage, links to recording and deck.
- Analysis panel (the point of the feature): overall score, per-dimension scores as small bars, strengths (green), improvements (amber), objections faced, SOP gaps, summary. "Re-run analysis" button hits request-analysis. Empty state when null: "Not analyzed yet".
- Transcript panel: collapsible, monospace, scrollable. Paste box if empty.
- Next step + notes, editable inline (PATCH).
- Framework reminder: a compact link to /sop/sales-call for the rubric.

### /sales/insights (app/(dashboard)/sales/insights/page.tsx)
The learning loop, read-only v1. Reuse recharts (already a dep) and kpi-card.tsx.
- KPIs: calls held last 30d, avg discovery score, avg pitch score, win rate on calls that reached pitch.
- Bar chart: avg score per rubric dimension across last N calls (shows where we are strong and weak).
- List: most common objections (counted from analysis.objections), each with handled-well rate.
- List: most common sop_gaps (which framework steps we skip most). This is what feeds SOP improvement.
No writes here. SOP auto-suggestions are a later phase, flagged in section 7.

## 5a. Telling sales calls apart from client meetings (shared Drive folder)

Both kinds of transcript land in one folder. Agent 06 already reads that folder and extracts client tasks from every Doc it sees. If we do nothing, it will try to turn a sales-call transcript into client tasks, and the sales analyst will try to score a client meeting. We need a router, and the schedule is what disambiguates.

Rule, in order:
1. When Seb books a sales call, the OS creates the pipeline_deal and a sales_calls row with status 'scheduled' and scheduled_at set. That row is the claim ticket.
2. When a new transcript appears, match it to a scheduled sales_calls row: company/prospect name appears in the Doc title or body AND scheduled_at is within +/- 12h of the Doc's meeting_date. On a match, attach the transcript to that row (transcript_source 'drive', drive_file_id set), set status 'held', and run the sales analysis. Do NOT run client-meeting task extraction on it.
3. No sales match means it is a client meeting. Agent 06 keeps its current behaviour untouched.
4. Ambiguous or unmatched sales calls (Seb forgot to book it first, or the name did not match) show in the OS as an "Unclassified transcripts" tray on /sales so Seb can one-click assign a transcript to a deal. Better a manual tap than a misfile.

Coordination with agent 06: the cleanest implementation is a shared pre-filter both agents call, a small function that, given a Doc, returns 'sales' (with the matched deal_id) or 'meeting'. Agent 06 skips Docs that return 'sales'; the analyst only processes those. Keep the matching logic in one place (a helper in the agent 07 package that agent 06 imports, or a tiny shared module) so the two never both claim the same Doc. The meeting_transcripts table already has file_id UNIQUE and the sales_calls table has drive_file_id UNIQUE, so a Doc can only be claimed once on each side; the router prevents it being claimed on both.

Practical note for Seb: always add the prospect and book the sales call in the OS before the call. That single habit is what makes the transcript route itself correctly and keeps client-task extraction from firing on a sales call.

## 5. Analysis engine (the transcript learning loop)

Two viable homes for the Claude call. Recommendation is Option A. This is the one open decision, confirm with Seb before building phase 4.

Option A (recommended, matches existing architecture): Python agent 07_sales_call_analyst, cloned from agents/06_meeting_tasks.
- Reuses agent 06's Drive client, Anthropic client, Supabase client, and launchd cadence. No new dependency in the OS, keeps AI out of the web app exactly like reporter and the other agents.
- Two triggers: (1) polls a dedicated "Sales Call Transcripts" Drive folder, matches each transcript to a deal by attendee email or company name (or leaves deal_id null for manual matching in the OS), inserts a sales_calls row with transcript_source 'drive'; (2) picks up rows flagged by request-analysis (status='held', analysis null).
- Model: Sonnet, not Haiku. Analysis quality matters more here than the cheap extraction agent 06 does. Prompt is built from lib/sales-rubric.ts dimensions plus the SOP framework text, output constrained to the analysis jsonb shape. Writes analysis + status='analyzed', posts a Discord digest (new notifySalesCallAnalyzed in discord-notify.ts).
- Downside: analysis is not instant, it lands on the next poll (make the flagged-rows pass run every 15 min so in practice it is a couple of minutes).

Option B (instant, but adds a dependency): add @anthropic-ai/sdk to the OS and do the Claude call inside /api/sales-calls/[id]/request-analysis server-side.
- Pro: analysis appears seconds after you paste a transcript, best UX for "analyze right after the call".
- Con: breaks the deliberate AI-in-agents separation, needs ANTHROPIC_API_KEY in Vercel env, first Claude call in the web app.

If Seb wants instant feedback over architectural purity, go B. Otherwise A. Build the rubric, prompt, and analysis jsonb identically either way so the two are swappable.

## 6. SOP pages (built from the four lessons)

Two new pages in app/(dashboard)/sop, same component style as sop/cold-call/page.tsx, added to the sop/page.tsx index list.

### /sop/sales-call  "Sales Call Framework"
Encodes the two-call process. Sections:
1. Before the call: analyze the lead, build the tailored deck, define the angle, professional setup (camera, clean background, share the relevant tab only).
2. Call 1, discovery and value: be first on the call, 60s intro, client-focused objective, guide the deck do not read it, stop to spark conversation, show value not price, redirect price questions, close by locking the second call.
3. Between calls: send the deck and a short summary within 24h, keep proving value, reconfirm the time.
4. Call 2, offer and close: small talk, "I have been working on your project", gauge feedback, present tailored solution, list specific services, describe workflow, present price linked to ROI, Q&A on objections, send agreement and next steps.
5. Objection handling: price, results, risk, what if performance is poor. Frame price objections as value-clarity gaps.
6. Checklist table (Stage / What to do / What to avoid) lifted from lesson 3.
7. The rubric: the exact dimensions the OS scores you on, so reps know the bar.

### /sop/sales-deck  "Most Valuable Pitch Deck"
Encodes the MVP deck framework. Sections: purpose (make it feel built for them), 10-20 slides, the slide structure (cover, agency overview 2-3, client highlight 1, problem discovery 2-3, solution 2-3, value examples 3-4, risk mitigation 1-2, process/timeline 1-2, NO price slide, NO next-steps slide), design guidelines, common mistakes to avoid.

## 7. Out of scope for v1 (flag, do not build)

- SOP auto-improvement: an agent that reads aggregated sop_gaps and proposes edits to the SOP pages. Insights page surfaces the data; acting on it stays manual for now.
- Automatic transcription of raw audio/video. We rely on Meet's transcript. If Seb wants Whisper on Loom recordings later, that is a separate agent.
- Deal auto-create from a calendar booking. For now a sales call attaches to an existing pipeline_deal or the drawer quick-creates one.

## 8. Phase plan and model assignments

Per Seb's token discipline: Opus planned this, cheaper models build. Suggested assignments:

- Phase 1 (Haiku): migration 011_sales_calls.sql + types in lib/types.ts + lib/sales-rubric.ts constants. Mechanical, spec is exact.
- Phase 2 (Sonnet): API routes under app/api/sales-calls + lib/sales-calls-client.ts. Needs the deal-stage side effects right.
- Phase 3 (Sonnet): UI. nav entry, /sales list + log drawer, /sales/[id] detail with analysis panel, /sales/insights. Match house style exactly.
- Phase 4 (Sonnet, after Seb confirms Option A vs B in section 5): analysis engine. If A, clone agent 06 into agents/07_sales_call_analyst with the Sonnet rubric prompt + Drive matcher + Discord digest. If B, the SDK route.
- Phase 5 (Haiku): the two /sop pages from section 6, added to the sop index.
- Opus checkpoint: review the analysis prompt in phase 4 before it ships, since prompt quality is what makes the learning loop worth anything.

Build order: 1 -> 2 -> 3 and 5 in parallel -> 4 last (depends on the section 5 decision).
