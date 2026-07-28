# Websites Cold-Call Agent Loop - Build Plan

Goal: fully automated loop. Hundreds of leads weekly -> 5 callers dial -> site requested from OS -> site auto-built from roofing-template -> delivered to caller via Discord -> caller sells on call -> picks Stripe link -> payment -> hookup -> client onto local-businesses newsletter campaign.

Execute with Opus. Phases ordered by urgency (Sebastian Garcia the sales manager needs docs today).

---

## Phase 0: Rename Juan G -> Sebastian Garcia (15 min)

Scope: cold_call_os only. Do NOT touch "Juan Diego / Juanda" (Spain outreach lead, different person) in gov_contracts/, knowledge/, lead_gen_instantly_agents_build/ unless Seb confirms.

1. `lib/discord-notify.ts:12` - "Juan will book your intro call" -> "Sebastian Garcia will book your intro call"
2. `app/api/cron/team-onboarding/route.ts:11` - "Seb + Juan: get CEO test call" -> "Seb + Sebastian Garcia: ..."
3. `app/(dashboard)/sop/os-guide/page.tsx` - "Media buyers: Ambar, Taij, Juan" - check context: if this Juan is Juan G, rename; media buyer list may be Juan Diego, verify with Seb if unclear. Default: rename.
4. `lib/team-server.ts:30-33` - "[Juan to add link]" x4 -> "[Sebastian Garcia to add link]"
5. SQL (copy to ~/Downloads as combined bundle):
   ```sql
   UPDATE team_members SET name = 'Sebastian Garcia' WHERE name ILIKE '%juan g%' OR name ILIKE 'juan';
   UPDATE profiles SET full_name = 'Sebastian Garcia' WHERE full_name ILIKE '%juan g%';
   ```
   Verify rows before running (SELECT first). Also add role for him: sales_manager.
6. Grep sweep after: `grep -ri "juan" cold_call_os/` must return only intentional leftovers.

## Phase 1: SOPs + Objection Handling PDF (today, Sebastian Garcia waiting)

Deliverables (all PDF copies to ~/Downloads, live versions in OS /sop):

1. **Master Caller SOP** - one doc, sendable today. Source material: `app/(dashboard)/sop/cold-call/page.tsx`, `sop/sales-call/page.tsx`, `sop/qualification/page.tsx`, plus the loop below. Structure:
   - Role + daily targets (dials, contacts, site requests)
   - Lead list access in OS (where, how assigned)
   - Call flow: opener -> qualify (roofer, no site or bad site, decision maker) -> pitch free preview -> request site in OS
   - Site request how-to (screenshots of form once built; interim: fields to collect - business name, owner name, phone, email, area, services, photos if any)
   - Follow-up call: present preview site -> close -> send Stripe link -> confirm payment
   - Handover: what happens after payment (hookup team takes over)
   - Discord etiquette: which channels, when tagged
2. **Objection Handling PDF** - UK roofer objections. Mine `app/(dashboard)/sales/insights/page.tsx` + `api/calls` transcript analysis for real objections logged. Core set: "I get work from word of mouth", "too expensive", "already have a site", "my nephew does it", "no time", "send me info", "is this a scam". Format: objection -> reframe -> question back -> close line. One page per objection max.
3. **Per-caller SOPs** - BLOCKED on names (Seb gives on call). Template ready: master SOP + name, personal targets, assigned lead segment, login creds section. Generate 5 from template when names arrive.
4. Add SOP page in OS: `app/(dashboard)/sop/caller/page.tsx` rendering master SOP so callers always see latest.

## Phase 2: Logins x5 (Discord + OS)

Existing flow works, use it: POST `/api/team` creates team_member -> POST `/api/team/onboarding` seeds 7-stage kanban + tasks -> welcome token portal `app/welcome/[token]` -> provision-login Discord notify.

Build/do:
1. Add `caller` role to `lib/access.ts`. Callers see: dashboard (own stats), pipeline (own leads), websites (request + view own requests), sop, resources, tracker. HARD BLOCK: /finance, /accounts, /onboarding (client), fee/MRR fields anywhere (fee rule: fulfilment side never sees money terms).
2. Supabase auth: create 5 users via admin API (invite email) once names/emails given. Store login_email + discord_user_id on team_members.
3. Discord: create #caller-floor channel (or per-caller channels #caller-<name>) + role @caller. Server invite links generated manually by Seb (bot can't create invites without elevated perms - one-time manual step, 5 min). Add Sebastian Garcia to the GC/management channel (his request).
4. Seed team_members rows + onboarding kanban entries for all 5 when names arrive.

## Phase 3: Site Request -> Auto-Build -> Discord Delivery

The core automation. Existing: `website_builds` table (status: requested/approved/building/built/site_approved/sent/rejected), `/websites` dashboard, `roofing-template/` Next.js template, `website_engine/` Mac-side builder.

1. **Request form** (caller-facing): `app/(dashboard)/websites/request/page.tsx` + POST `api/websites/request`. Fields: business_name, owner_name, phone, email, service_area, services (checkboxes: pitched, flat, repairs, guttering, etc), google_maps_url, existing_site_url, photos upload (Supabase storage), notes. Creates website_builds row status=requested, requested_by = caller id. Discord notify to #site-builds channel.
2. **Auto-build**: website_engine Mac watcher (launchd, check existing Mac automation system first before new cron). Poll: GET `api/websites/queue` for status=requested. For each:
   - Copy roofing-template, inject business data (name, area, services, phone, colours from logo if provided, stock roofing photos fallback)
   - AI copy pass (Haiku): hero line, about, service blurbs localised to area
   - Deploy to Vercel: `<business-slug>.vercel.app` (or previews subdomain)
   - PATCH build row: status=built, preview_url
   - Decision needed: skip `approved` gate for speed (auto requested->building) or keep Seb approval? Recommend: auto-build, Seb spot-checks before caller presents. Set status straight to built.
3. **Discord delivery**: on status=built, webhook posts to #site-builds: preview URL + tags requester's discord_user_id ("@caller site for Smith Roofing ready: <url>"). Add `notifySiteBuilt()` to discord-notify.ts. Mark status=sent.
4. **Websites dashboard update**: caller view filtered to own requests; Seb view sees all + reject/rebuild buttons.
5. SLA: target under 24h request->delivered. Cron (daily, Hobby plan limit) flags builds stuck >24h to pulse channel.

## Phase 4: Stripe Link Picker + Payment -> Hookup

1. Create Stripe Payment Links (one-time manual in Stripe dashboard, or via API): SITE_1500 (setup 1500), SITE_2000 (setup 2000), HOSTING_75 (75/mo subscription). Store link URLs in env or a `stripe_payment_links` table.
2. Caller UI: on deal/build card, "Get payment link" picker -> copies link with `client_reference_id=<build_id>` appended so webhook can match.
3. Extend `api/webhooks/stripe/route.ts`: handle `checkout.session.completed` -> match build via client_reference_id -> mark deal won in pipeline, notifyDealWon, create hookup tasks.
4. **Hookup checklist** (auto-created tasks on payment, real kanban vocabulary per task system):
   - Buy/transfer domain, point DNS to Vercel
   - Attach custom domain to Vercel project
   - Swap preview slug to real domain
   - Set up business email forward (optional)
   - Send handover email (template)
   - Add to newsletter campaign (Phase 5)
   Assign to fulfilment, Discord notify.

## Phase 5: Newsletter Local Businesses Campaign

OPEN QUESTION for Seb: is this (a) our nurture newsletter TO local business clients/prospects, or (b) a newsletter service we run FOR the client? Build differs. Thin version now assuming (a):

1. `newsletter_subscribers` table (client_id, email, business_name, added_at, source='site_purchase')
2. On payment webhook: auto-insert client
3. Resend audience + monthly send (content authored separately, not in this plan)
4. If (b): becomes an upsell product page + fulfilment SOP instead. Park until answered.

## Phase 6: Funnel Metrics

Wire the loop's numbers into dashboard: leads assigned -> dials -> contacts -> site requests -> sites delivered -> follow-up calls -> paid. Per-caller and total, weekly view. Extend `/tracker` or `/dashboard`. Feeds Sebastian Garcia's management of the 5 callers.

---

## Execution order for Opus

1. Phase 0 (rename) + Phase 1 items 1-2 (master SOP + objection PDF) - TODAY, Sebastian Garcia waiting. PDFs to ~/Downloads, ping Seb with files.
2. Phase 2 item 1 (caller role/access) + Phase 3 (request form + Discord delivery + queue API) - the loop core.
3. website_engine watcher (Phase 3.2) - check Mac automation system first, reuse launchd patterns.
4. Phase 4 (Stripe links + webhook + hookup tasks).
5. Phase 5 thin + Phase 6.
6. Blocked-on-Seb: 5 caller names/emails, Juan Diego confirm, newsletter direction, Discord invites, Stripe link creation (needs live Stripe access).

## Rules that apply (from memory)

- No em-dashes anywhere in generated docs/PDFs.
- No fee/MRR on fulfilment-side pages; caller role must never see money fields.
- New GET route handlers need `export const dynamic = 'force-dynamic'`.
- Deploy live via Vercel CLI after each phase ships. Hobby plan: daily crons only.
- Migrations: copy combined SQL bundle to ~/Downloads for one-paste.
- Ship actual deliverables with live links, not descriptions.
