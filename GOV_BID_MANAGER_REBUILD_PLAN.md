# Gov Contracts Rebuild Plan (22 Jul 2026)

Audit found: pipeline dead since 21 Jul (Anthropic credits exhausted + Mac asleep at cron = DNS fails), submission deadline discarded (no column anywhere), 12 of 15 drafted bid PDFs never uploaded to OS, warmup OFF on the sending mailbox (score 29), one live email sent containing leaked LLM meta-commentary, tracker claims 20 pushed vs 18 live in Instantly.

Goal: /gov-contracts/bids becomes the daily submission cockpit — every actionable tender shows title, authority, submission deadline, bid PDF download, portal URL to submit at, date found — plus an Instantly outreach section. Engine hardened so bad AI output can never be sent again.

## Part A — gov_engine (Python)

A1. **Deadline + portal fields end-to-end.**
- `gov_tracker.py` FIELDS: add `deadline`, `portal`, `portal_kind` (after `notice_url`).
- `planning_notices.py` already captures `deadline` — persist it into the tracker row. `expiring_contracts.py` leads: deadline stays empty (renewal plays have no deadline yet); persist `portal`/`portal_kind` from `extract_portal()` on both paths.
- `gov_supabase.py` sync: include the three new fields in the upsert payload.
- Backfill: for the 15 `bid_drafted` + 20 `pushed_to_instantly` rows, re-fetch the OCDS release (contracts_finder/fts) and fill deadline/portal where available. Best effort; skip on network error.

A2. **Personalization safety guard (the leaked-email bug).**
- `gov_ai.personalize()`: reframe prompt — guidance block is context for the WHOLE sequence, output is ONLY the 2-sentence opener; make this explicit so the two instruction sets no longer conflict.
- Hard output guard: reject and retry once, then fall back to a safe generic opener, if output contains meta-markers (case-insensitive: "your request", "i'm reading", "i am reading", "here are the", "sentences", "instruction", "guidance"), exceeds 60 words, or contains a newline-delimited list.
- `gov_sequences.check_render()`: add the same content-sanity check on `personalization` and `greeting` (reject "Hi Procurement,"-style greetings: if greeting name matches ROLE_WORDS, force "Hi there,").
- Fix stale comment "Day 0, 2, 5, 10" -> actual 0/2/3/5.

A3. **Bid PDF backfill to OS.** One-off script `backfill_bid_documents.py`: for every `bid_drafted`+ row with empty `bid_document_path`, find matching PDF in `gov_engine/bids/` (slug match on title), upload via `gov_supabase.upload_bid_document()`, set `bid_document_path`, re-sync. Run it. All 15 PDFs must be visible in the OS after.

A4. **Cron resilience.** Add midday catch-up cron entries (12:00 expiring, 12:15 planning, 11:45 scraper, Mon-Fri) that run ONLY if the morning run failed — simplest: each script already logs; add a `--catchup` flag that exits 0 immediately if today's run already wrote a success marker (`data/last_success_<name>.txt` stamped at end of successful run). Update crontab via `setup_gov_cron.sh` (keep idempotent).

A5. **Torus repair.** The two Torus rows (`68bd63fa…`, `1d07067b…`) are marked `pushed_to_instantly` but never entered the gov campaign. Reset status to `found`, clear campaign_id, so the next live run re-processes them properly. Do NOT push them directly (no sends outside the normal pipeline).

A6. **Sheets**: add Deadline + Portal columns to "All Leads" and "Bid Tracker" tab writes in `gov_sheets.py` (best-effort as now).

## Part B — cold_call_os (Next.js + Supabase)

B1. **Migration `0XX_gov_deadline_portal.sql`** (next free number):
```sql
ALTER TABLE gov_tenders ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE gov_tenders ADD COLUMN IF NOT EXISTS portal TEXT;
ALTER TABLE gov_tenders ADD COLUMN IF NOT EXISTS portal_kind TEXT;
CREATE INDEX IF NOT EXISTS idx_gov_tenders_deadline ON gov_tenders(deadline);
```
Copy to ~/Downloads as combined SQL (house rule).

B2. **Rebuild `/gov-contracts/bids` (Bid Manager).**
- Default view: status `bid_drafted` (the "submit these" queue), sorted by `deadline` asc, nulls last. Tab bar for other statuses stays.
- Columns: Title | Authority | Deadline (countdown badge: red <7d, amber <14d, grey none) | Value | Bid PDF (download button, signed URL, existing endpoint) | Submit at (labeled portal link: show `portal` if set else `notice_url`; label = portal domain) | Found (date_added) | Status dropdown | Updated.
- Row expand: buyer_name, buyer_email, cpv, incumbent, notes (editable), notice_url.
- Keep PDF upload (revisions). Guard all new fields as optional (UI must not crash before migration applied).
- Mark-submitted flow: status dropdown -> `submitted` sets last_update (already works); add a one-click "Mark submitted" button on rows with a PDF.

B3. **Rebuild `/gov-contracts` dashboard.**
- KPI row: bids awaiting submission (bid_drafted), submitted, won, upcoming deadlines (next 14d), emails sent total, replies total.
- Instantly Outreach section: daily chart from `gov_instantly_daily` (sent/opens/replies, last 30d), campaign status line (mailbox, daily cap, warmup status — static text fed from a new `gov_campaign_meta` note is overkill; just show the daily table as now but styled), plus link to Bid Manager.
- Pipeline health strip: last sync time (`max(synced_at)` from gov_tenders) with stale warning if >48h.
- Match existing OS dark theme tokens (#08090c/#10121a/#1c2035, KpiCard pattern from cold-email tab).

B4. **API routes**: extend `/api/gov-contracts/bids` GET to return new fields + support sort; extend `/api/gov-contracts` GET with new KPIs + last-sync. All new/changed GET route handlers MUST export `const dynamic = 'force-dynamic'` (house rule).

B5. **Deploy** to production via Vercel CLI after build passes.

## Part C — Seb actions (cannot be coded)

1. **Top up Anthropic API credits** for the key in `lead_pipeline/.env` — entire AI side (fit checks, bid drafting, optimizer, personalization) is dead until then.
2. Apply migration SQL (will be in ~/Downloads).
3. Warmup on avamontero mailbox — enable in Instantly (Accounts -> avamontero -> warmup). Score is 29; expect 2-3 weeks of warmup before deliverability recovers. Consider adding a second gov mailbox.
4. Submit the drafted bids — 15 PDFs waiting, several deadlines live.
