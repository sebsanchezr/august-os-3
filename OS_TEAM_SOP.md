# August OS Team SOP

The daily operating manual for August OS (augustosv3.vercel.app). Every piece of client work runs through the OS. If it is not in the OS, it did not happen.

Audience: Seb (owner), media buyers (Ambar, Taij, Juan), ad editors (Alvin), and fulfilment. A rendered version of this guide lives in the OS at `/sop/os-guide`.

---

## 1. Morning Routine (per role)

Everyone starts the day in the OS, not in WhatsApp or email. Order matters.

**Everyone, first 5 minutes:**
1. Open `/updates`. The daily digest posts at 07:00 UTC and rolls up yesterday: EOD call numbers, cold email replies, tasks completed and created, meetings held yesterday and scheduled today, plus anything new that shipped in the OS.
2. Open `/tasks` and filter to yourself. Anything assigned to you or where you are a collaborator is your day.

**Account managers / fulfilment:**
1. `/fulfilment` is your home page. It shows Your Tasks, overdue counts, meetings this week, onboardings in flight, and clients at risk.
2. `/accounts/comms` next. This is the SLA inbox. Every unanswered inbound client message has a live countdown: WhatsApp messages must be answered within 2 hours, emails within 24 hours. Clear anything close to breach before doing anything else.
3. Check `/accounts/issues` for open issues on your clients.

**Media buyers (Ambar, Taij, Juan):**
1. `/tasks`, Creative Pipeline tab, check the "Sent to Media Buyer" column. Those creatives are approved and waiting on you to put them live.
2. `/ads`, cycle through each of your clients. Read the KPIs and hygiene findings (see section 5).
3. `/meetings` for any client calls today. Prep packs appear in the meeting slide-over.

**Ad editors (Alvin):**
1. `/tasks`, Creative Pipeline tab. Your columns are Brief, Editing, and Revision. Revision items come first, a client is waiting on them.
2. `/creatives` for any strategies marked Delivered with fresh image grids, and any Quick Generate output waiting to be turned into finished ads.

**Seb:**
1. `/accounts/approvals`. Nothing goes to a client until it is approved here. Clear the queue every morning.
2. `/accounts/issues`. Any trust-threatening or financial issue is founder-handled, same day, personally.
3. `/pipeline` and `/sales` for the acquisition side.

---

## 2. Task Workflow

The board at `/tasks` has two tracks, switched by tabs at the top.

**Creative Pipeline** (client ad creatives):
Brief -> Editing -> Revision -> Approved by Client -> Sent to Media Buyer -> Live

**Ops** (everything else):
Brief -> In Progress -> Review -> Completed

**How tasks move:**
- Drag and drop on the board, click the status pills in the task detail panel, or use the inline dropdown on `/tasks/list`. All three do the same thing.
- Who moves what: editors own Brief through Revision. The account manager or Seb moves a card to Approved by Client once the client signs off, then to Sent to Media Buyer. The media buyer owns the final move to Live once the ad is running. On the Ops track, the assignee moves their own card.
- Reaching Live or Completed stamps the task as done. Completed tasks drop off the board and can be found (and restored) at `/tasks/archive`.

**Creating tasks:** press `N` on the board or click New task. Title is the only required field, but always set assignee, client, priority, and due date. Every client deliverable gets a task. No side-channel work.

**The Sent to Media Buyer handoff:** moving a creative task into this column fires a Discord notification tagging the assignee: "Creative ready to go live." The media buyer picks it up, uploads the creative to the ad account, and moves the card to Live. There is no auto-reassignment, so make sure the task is assigned to the right buyer before you move it.

**Comments and Discord:** comments live in the task detail panel. Commenting on someone else's task pings the task owner on Discord. Assigning a task pings the new assignee. Use comments for all task context so the history stays on the card, not in DMs.

---

## 3. Client Management Daily Cadence

**Log every client touch.** Open the client's HQ (`/accounts`, click the client) and use the Log comm quick action on the Overview tab. Record direction (inbound or outbound), channel (WhatsApp, email, call, meeting), sentiment, and a one-line summary. This is non-negotiable: the SLA inbox, the health dots, and the weekly reports all read from this log.

- Logging an inbound comm starts a response clock (WhatsApp 2h, email 24h).
- Logging an outbound comm clears the oldest open clock for that client automatically. You can also click Responded directly in `/accounts/comms`.
- If your summary contains warning trigger words, the OS fires an early-warning Discord alert. That is intended, do not soften the summary to avoid it.

**Client HQ tabs:** Overview (health, stats, tasks, issues, recent comms, quick actions), Assets, Weekly Report, Past Meetings, History, Settings (targets, ROAS goal, Meta ad account ID, reporting cadence).

**Weekly reports approval flow:** the Mac reporter drafts each client's Friday EOW report and Monday kickoff message automatically and inserts them as pending approval. They appear in `/accounts/approvals` with an internal brief (for your eyes only) and an editable client message. Seb reviews, edits inline if needed, and clicks Approve. Approval posts the final copy-paste-ready message to Discord, and the account manager forwards it to the client's WhatsApp group. Rejecting captures a note and sends it back for a redraft. Nothing is ever sent to a client without passing this queue.

**Issues board rules** (`/accounts/issues`): Open -> Resolving -> Resolved.
- Raise issues from the client HQ (Raise issue quick action) with category, severity, and owner.
- Major and trust-threatening severities, and anything in the financial category, alert Discord immediately and are founder-handled the same day.
- An issue cannot be marked Resolved without a root cause and a process fix. Fix the system, not just the instance.

**Meetings** (`/meetings`): prep packs are drafted automatically about a day before each call and land in the approvals queue. After the call, the transcript is picked up automatically, minutes are drafted, and action items are inserted as tasks. Review the draft minutes in the meeting slide-over, then Send to client (gated on the follow-up report being approved). Add talking points during the week via the client HQ quick action, they get woven into the next report.

---

## 4. Ad Creative Workflow

All creative generation lives at `/creatives` (Creative Hub).

**Weekly strategy cycle (one card per client per week):**
1. **Draft** (amber): create via New Strategy, pick the client and this week's focus. The OS drafts a strategy with three static ad concepts using the client's last 14 days of metrics and the knowledge base.
2. **Approved** (indigo): a human reads the strategy and clicks Approve. Nothing generates until a person approves.
3. **Generate statics**: click the button on an approved card. The OS renders the three concepts as static images (about a minute).
4. **Delivered** (emerald): the images appear as a grid on the card. Each image has Open and Copy URL. Not happy with a concept? Click Regenerate to re-run the whole set.

**Quick Generate (ad hoc, no strategy needed):** the form at the top of `/creatives`. Pick the client, set quantity (1 to 4), and write a plain-language brief ("bold product-on-colour ad for the summer sale, price 29.99, urgent tone"). Statics generate in under a minute and appear right below the form. Use this for urgent requests, quick tests, and client asks mid-week.

**Where images land and how editors pick them up:** every generated image is stored with a permanent public URL, surfaced in the grids on `/creatives`. Editors (Alvin) open or copy the URL straight from the grid, finish the ad if needed, and attach it to the creative task. Nothing is pushed to Meta automatically. A human always sits between generation and live spend.

---

## 5. Media Buyer Workflow

Daily, per client, at `/ads`:

1. Pick the client from the dropdown. Read the four KPI cards (7-day spend, revenue, ROAS, CPA), the 14-day spend/ROAS chart, and the daily breakdown table. Metrics sync from Meta automatically every morning.
2. Press **Generate Recommendations**. This runs two things:
   - **Hygiene findings** (deterministic checks against the live account): active ad sets spending with zero purchases, paused winners beating target ROAS, active ads far below target, frequency fatigue (7d frequency over 4), active entities with no delivery, spend up while ROAS down, duplicate ad set names, and budget outliers. Each finding names the exact entity with the numbers.
   - An **AI operational review** that turns those findings into a prioritised checklist, highest severity first.
3. Work the checklist top to bottom. Verify each flag inside Ads Manager yourself, then act (or consciously decide not to).

**What the tool does NOT do:** it never touches your account. It cannot pause, launch, edit budgets, or change anything on Meta, it is read-only by design. It also does not do strategy: no new audiences, no new campaign structures, no scaling plans. It only catches operational things you may have missed. You stay in control of every decision.

If a hygiene finding was intentional (for example a deliberately paused winner), just move on. The point is that every anomaly gets consciously reviewed.

---

## 6. Onboarding a New Client

Two paths, do not mix them up:

**Full onboarding pipeline (the default for every closed-won deal):** on `/pipeline`, mark the deal Won, then click Start Onboarding. That creates the onboarding record, sends the contract, and raises the first invoice automatically. The card then walks the `/onboarding` board: Won -> Contract Sent -> Signed -> Form Completed -> Kickoff Booked -> Kickoff Held -> Building -> Launched -> Handed Off. Signing unlocks the client welcome portal and creates the client record. **Payment gates launch**: a client cannot be flipped to Launched until the first invoice is paid. Each milestone posts to Discord.

**New client button on `/accounts` (the shortcut):** creates a bare client record with name, contact, and services. No contract, no invoice, no portal. Use it only for clients that predate the OS or genuinely skip onboarding. Everything else goes through the pipeline.

After creation, fill in the client's Settings tab (ROAS target, budget, Meta ad account ID, reporting cadence) or the ads and reporting features will have nothing to work with.

---

## 7. EOD Reports

Cold callers submit an EOD report at `/eod` every working day, no exceptions. Click Submit EOD and fill in: your name, calls made, positive replies, calls booked, and notes. The page shows your positive rate and booking rate live, and the numbers feed the next morning's digest on `/updates`. An unsubmitted EOD means your day's work is invisible to the team.

---

## 8. What Is Automated vs Manual

**Automated (Vercel crons, all times UTC):**
- 05:45 meta-sync: pulls the last 3 days of Meta metrics for every connected client.
- 06:00 calendar-sync: syncs meetings from Google Calendar.
- 06:30 instantly-sync: cold email stats.
- 07:00 daily-digest: writes the daily roll-up to `/updates`.
- 08:00 invoice-reminders: flags invoices due.
- 09:00 report-approvals: pings Discord about any report still waiting in the approvals queue.
- 09:00 Mon-Fri upwork-search: pulls new Upwork opportunities.
- 10:00 metrics-staleness: warns on Discord if client metrics have stopped syncing.

**Automated (Mac reporter, runs on Seb's Mac, drafts only, never sends):**
- Daily metrics sync with top creatives and competitor notes.
- Friday EOW client reports and Monday kickoff messages (drafted into the approvals queue).
- Meeting prep packs about 24h before each call.
- Post-meeting minutes and action-item tasks from transcripts, checked every 15 minutes.

**Automated (Discord notifications):** task assignments, comments, media buyer handoffs, reports ready for approval, approved client comms, issue alerts, SLA warnings and breaches, meeting reminders, onboarding milestones, deal won/lost, creatives generated.

**Always manual (by design):** approving anything client-facing, sending WhatsApp messages, moving task cards, approving creative strategies, every change inside Meta Ads Manager, and marking issues resolved. The system drafts and flags. Humans decide and send.

---

## 9. Troubleshooting

**Empty or stale data almost always means an environment variable or a dead token, not a bug.** Check `ENV_CHECKLIST.md` in the repo root first, it maps every env var to exactly what breaks without it.

Common cases:
- `/ads` shows "No ad data yet" or metrics stop updating: the Meta access token is dead or missing. The meta-sync cron silently skips when the token is gone. The 10:00 metrics-staleness cron should have warned on Discord.
- A client shows "(Not connected)" in the `/ads` dropdown: no Meta ad account ID on the client's Settings tab.
- Generate Recommendations or strategy drafting errors: Anthropic API key missing or invalid.
- Image generation fails on `/creatives`: Gemini or OpenAI image key missing, or billing disabled on the key. The error message says which.
- No Discord notifications: the relevant Discord webhook URL is unset. Notifications fail silently and never block the app, so nothing else will look broken.
- A cron seems to never run: it may be getting a 401, check `CRON_SECRET` matches between Vercel and the environment.

If a fix requires changing environment variables in Vercel, that is Seb. Everything else: raise it as an Ops task on `/tasks` with priority set honestly.

---

*August Marketing, internal use only. Keep this document in sync with `/sop/os-guide` in the OS.*
