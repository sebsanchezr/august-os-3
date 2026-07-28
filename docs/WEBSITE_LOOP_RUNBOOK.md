# Website Cold-Call Loop — Operator Runbook

Everything built for the loop, plus the manual steps only you can do (Discord admin clicks, Stripe link creation, caller provisioning). Work top to bottom to go live.

## The loop (what happens now)

1. Caller opens Websites tab, clicks Request a website, fills business + owner + email + area + services.
2. Request lands as status `requested`. Discord posts to the web-dev channel.
3. You click Approve. Status goes `approved`. The Mac build engine picks it up.
4. Engine builds the site from the roofing template, deploys to Vercel, sets status `built` with the preview URL.
5. You review the preview, click Approve site (`site_approved`), then Mark sent to caller (`sent`).
6. On `sent`, Discord @tags the caller with the live preview so it hits their mentions.
7. Caller presents the site on the follow-up call, copies the right Stripe link from the card (£1,500 / £2,000 / £75mo), sends it.
8. Prospect pays. Stripe webhook fires: build goes `paid`, hookup checklist is seeded, client is added to the newsletter list, Discord celebrates.
9. Fulfilment opens the hookup checklist on the card, ticks each item. When all done the build flips to `live`.

## 1. Run the migration

From either Mac in `cold_call_os`:
```
npm run migrate
```
Applies `060_website_sale_loop.sql` (new columns on website_builds, website_hookup_tasks, newsletter_subscribers).

## 2. Stripe payment links (do in Stripe dashboard)

Create three Payment Links, then set the env vars in Vercel (Project settings, Environment Variables) and redeploy:

| Link | What | Env var |
|---|---|---|
| £1,500 one-time | Website build | `NEXT_PUBLIC_STRIPE_LINK_SITE_1500` |
| £2,000 one-time | Website build | `NEXT_PUBLIC_STRIPE_LINK_SITE_2000` |
| £75 / month | Hosting subscription | `NEXT_PUBLIC_STRIPE_LINK_HOSTING_75` |

Set the value to the base link URL (e.g. `https://buy.stripe.com/xxx`). The OS appends `?client_reference_id=<build_id>` automatically so payments match back to the build. Until these are set the picker shows a "set the envs" note instead of buttons.

Webhook: point a Stripe webhook at `https://augustosv3.vercel.app/api/webhooks/stripe` for event `checkout.session.completed`, and set `STRIPE_WEBHOOK_SECRET` in Vercel (already used by the existing invoice webhook).

## 3. Discord (do in Discord, admin)

- Create a channel for site builds (or reuse the web-dev channel). Create its webhook, set `DISCORD_WEBDEV_WEBHOOK_URL` in Vercel. Falls back to the tasks webhook if unset.
- To make the "site ready" post actually @tag a caller, store each caller's Discord user id on their `team_members` row (`discord_user_id`) and pass it as `requested_by_discord` on the request (wire this to the caller's profile once logins exist). Without it the post still fires, just untagged.
- Create a `@caller` role and a `#caller-floor` channel. Generate 5 one-time invite links (Server Settings, Invites) and send one to each caller. This is the manual admin step, the bot cannot mint invites.
- Add Sebastian Garcia (sales manager) to the management channel.

## 4. Caller logins x5 (when you have names + emails)

For each caller:
1. Supabase dashboard, Authentication, Add user (or send an invite) with their email.
2. Add their email to `COLD_CALLER` in `lib/access.ts` and push. Callers get: dashboard, EOD, resources, websites, plus the always-allowed overview/updates/team. They are blocked from finance, accounts, onboarding, tasks, meetings, and everything with fees (house rule: fulfilment side never sees money terms).
3. Create their `team_members` row via the Team tab (name, login_email, discord_user_id) and start their onboarding kanban.
4. Generate their personalised SOP from `docs/PER_CALLER_SOP_TEMPLATE.md`.

Current `COLD_CALLER` allowlist holds one email. Add the five new caller emails there when they arrive.

## 5. Docs to send Sebastian Garcia today

- `docs/CALLER_MASTER_SOP.md` — master caller SOP.
- `docs/OBJECTION_HANDLING.md` — objection playbook.
- Live in the OS at `/sop/caller` and `/sop/objections`.

## Env var checklist (Vercel)

```
NEXT_PUBLIC_STRIPE_LINK_SITE_1500
NEXT_PUBLIC_STRIPE_LINK_SITE_2000
NEXT_PUBLIC_STRIPE_LINK_HOSTING_75
STRIPE_WEBHOOK_SECRET            (existing)
DISCORD_WEBDEV_WEBHOOK_URL       (optional, falls back to tasks webhook)
```

Mac build engine (`website_engine/`) needs `VERCEL_TOKEN`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (see website_engine/README.md).
