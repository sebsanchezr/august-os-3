# Ad Creative Engine: Strategy & Build Plan

**Author:** Fable (strategy only: Opus/Sonnet/Haiku execute)
**Date:** 6 July 2026
**Status:** PLAN: awaiting Seb approval
**Research basis:** 106-agent verified deep-research run (sources cited inline). Tool capabilities verified against primary sources as of July 2026. All third-party tool PRICING failed verification: confirm with vendors before committing spend.

---

## 1. The Opportunity

Creative is the single biggest lever in paid ads. NCSolutions' ~450-campaign meta-analysis attributes **49% of incremental sales to creative quality** (49% digital, 46% social: vs 28% media, 26% brand). Verified 3-0. Targeting and media optimisation are commoditised by Meta's own algorithms; creative volume and quality is where an agency wins.

Meanwhile the production cost of creative has collapsed:
- **Nano Banana (Gemini image API)** now renders legible ad copy inside images, 512px-4K, all Meta/TikTok aspect ratios (1:1, 4:5, 9:16, 16:9). Static ads at ~$0.03-0.15/image depending on tier. Verified against Google's official docs.
- **Creatomate render API** turns one designed template + JSON into hundreds of on-brand image/video variants. Verified.
- **Higgsfield** aggregates 30+ video models (Sora 2, Veo 3.1, Kling 3.0, Seedance 2.0) with ad-specific apps: URL-to-video Marketing Studio, Lipsync Studio, headshot/face-swap. Verified capabilities; pricing tiers refuted, check directly.
- **Trendtrack** (DECIDED: replaces Foreplay; Seb already subscribes) gives competitor + store intelligence across Meta and TikTok: winning-ad discovery, plus Shopify store analytics on 300k+ stores (revenue/traffic estimates, live ad counts, trending products). Crucially it exposes an **MCP** ("Connect Claude, ChatGPT... to pull stores, ads, advertisers, and emails") so the strategy agent can query it directly, no manual export. We do NOT need Foreplay's Briefs/Lens modules — our Layer 2 agent writes briefs and Layer 4 does the analytics off Meta data.

Sentiment check (directional, sources have commercial stakes): 73% of marketers say AI-assisted content outperforms human-only; System1/Jellyfish found 18 AI-assisted video ads averaged 3.4 stars vs a 2.3 database average. BUT consumer enthusiasm for obviously-AI content collapsed from 60% (2023) to 26% (2025). **Implication: the winning play is AI production economics with native-feeling output and human QA: never visible "AI slop".**

## 2. The Product

A weekly, data-driven creative engine inside August OS:

> Every week, for every ad-creatives client: the agent ingests ad account + store + dashboard data → mines what's winning and dying → drafts a creative strategy (concepts, angles, hooks, formats, volumes) → Seb/team approves in the OS → the pipeline mass-produces statics (and video where viable) → assets land in an approval queue → approved assets ship to the client / ad account.

Humans do two things only: **approve the strategy** and **approve the assets**. Everything else is agent + API work.

## 3. Architecture (five layers)

### Layer 1: Data ingest (weekly, automated)
Pull into Supabase per client:
- **Meta Marketing API** (and TikTok later): per-ad spend, ROAS, CTR, CPM, hook rate (3s video views / impressions), thumbstop, hold rate, frequency, first-time impression ratio. We're building the low-cost ads manager anyway: this is the same ingestion; the creative engine is a consumer of that data, not a second pipeline.
- **Store data** (Shopify API where available): top sellers, margins, new products, review text (angle mining), post-purchase survey answers if the client runs them.
- **Competitor + store intel**: Trendtrack via its MCP: the strategy agent pulls winning competitor ads (Meta/TikTok) and Shopify store data (trending products, revenue/traffic, ad-spend peaks) per client niche each week for concept mining. No manual export step.
- **Creative metadata**: every asset we produce is tagged in Supabase with concept / angle / hook / format / visual style, so performance joins back to creative DNA, not just ad IDs.

### Layer 2: Analysis + strategy agent (the brain)
Weekly agent run per client (Sonnet-class, prompt spec'd by Fable):
1. Rank last 30/90 days of ads by concept/angle/format tags: what's scaling, what's fatiguing (frequency up + CTR down), what died in testing.
2. Diagnose the funnel: is the problem thumbstop (hook), hold (body), or CTR/CVR (offer/landing)?
3. Mine reviews/surveys/competitor boards for untested angles.
4. Output a **Creative Strategy Doc**: 3-5 concepts, each with angles, hooks, formats, and a variant count; explicit split of **iterations of winners vs net-new concepts** (default 70/30, tunable per account maturity); flat list of every asset to be produced with its template + copy + image inputs.

### Layer 3: Approval UI (in the OS)
- New **Creatives** tab per client: strategy card (concepts, rationale, data receipts: "this angle because hook rate on X was 42% and it's fatiguing"), approve / edit / reject per concept.
- Nothing renders until strategy is approved. Approval writes a production queue.

### Layer 4: Production pipeline (the factory)
Statics, three routes by asset type:
- **Templated statics (volume play):** designer (or AI) builds 10-20 Creatomate templates per client once, on-brand. Agent fills template_id + modifications JSON (headline, product shot, review quote, price, CTA) → hundreds of variants per week, pixel-perfect brand compliance by construction. This is the workhorse.
- **Generative statics (net-new concepts):** Nano Banana 2 / Pro via Gemini API for lifestyle scenes, product-in-context, mockups, meme-style natives. Keep in-image text under ~25 characters (verified accuracy limit): long copy goes in Creatomate overlays instead. Pro blends up to 14 input images with consistency (product + brand refs in every gen).
- **Hybrid:** Nano Banana generates the background/scene → Creatomate composites brand fonts, logo, copy. Best of both: generative variety + typographic control.

Video (phase 2):
- Higgsfield API/Marketing Studio: product URL → UGC/CGI/cinematic drafts; Lipsync Studio for avatar VSLs.
- Creatomate video templates for data-driven video variants (hook text swaps, product swaps): cheaper and more reliable than full generation for iteration volume.

Every asset auto-QA'd by a vision-model check (text legibility, brand colours, no artifacts, correct aspect ratios) before it hits the human queue.

### Layer 5: Asset approval + delivery (DECIDED)
- **Approval: internal-only.** Grid view in the OS where Seb/team approve/reject per asset with bulk actions. No client-facing share link. The team is the sole quality gate before anything leaves the building. (Client-facing approval can be added later if a client contracts for it, but it is NOT built in v1.)
- **Delivery: files only.** Approved assets are written to the client's Drive folder with a naming convention encoding concept/angle/hook/format tags. NO direct push to the Meta ad account in v1. The media buyer uploads and launches manually, keeping a human between the factory and live spend.
- Because delivery is file-based, the performance loop (Layer 4) reads Meta data by matching the asset naming convention / file to the live ad, rather than by an ad ID we created. The tagging convention is therefore load-bearing: it must survive the manual upload step (e.g. buyer keeps the filename as the ad name, or we map filename to ad name in the ads manager).
- Tags close the loop: next week's Layer 2 run reads performance BY TAG.

## 4. What the data loop actually learns
Per client, compounding weekly:
- Angle league table (problem-solution vs social proof vs offer vs founder story vs meme...) by ROAS and hook rate.
- Format league table (static vs carousel-style vs video; polished vs native/"ugly").
- Hook patterns that stop the scroll for THIS audience.
- Fatigue curves → predict refresh cadence before performance dies.

This per-client creative memory is the moat. Any agency can prompt Nano Banana; nobody else has the client's tagged performance history driving next week's brief.

## 5. Honest caveats from the research
- **No verified industry norms** survived fact-checking for creatives-per-week-per-£spend, iteration ratios, or named fully-automated agency pipelines. The 70/30 iteration split and volume defaults below are practitioner convention, not verified fact: treat as starting hypotheses the data loop tunes.
- **All tool pricing claims failed verification** (Arcads, Creatify, Higgsfield tiers). Budget line items must be confirmed on vendor sites before commitment.
- **Model landscape churns monthly.** Model IDs verified July 2026 (gemini-3.1-flash-image, gemini-3-pro-image, etc.): re-check at build time.
- **AI-slop risk is real** (consumer enthusiasm 60%→26%). Native-feeling output + human QA gate is a hard requirement, not a nice-to-have.

## 6. Suggested defaults (hypotheses, tune per account)
- Volume: ~20-40 statics/week per client at £10-30k/mo spend; 4-8 video variants once phase 2 lands.
- Split: 70% iterations of proven concepts, 30% net-new.
- Testing: dedicated testing campaign/ASC, kill thresholds by spend-without-purchase relative to AOV, promote winners weekly.

## 7. Build phases (for Opus/Sonnet to execute: NOT Fable)
1. **Phase 1: Data + tags (week 1):** Supabase schema (clients, assets, tags, ad_performance), Meta API ingestion (shared with ads manager build), asset tagging convention.
2. **Phase 2: Strategy agent + Creatives tab (week 2):** weekly cron agent producing the Strategy Doc, approval UI in the OS.
3. **Phase 3: Static factory (weeks 2-3):** Creatomate templates per pilot client, Nano Banana integration, hybrid compositing, auto-QA, internal asset approval grid, file delivery to the client Drive folder with tagged naming convention.
4. **Phase 4: Learning loop (week 4):** performance-by-tag reporting feeding the strategy agent, fatigue detection.
5. **Phase 5: Video (later):** Higgsfield/Creatomate video, only after statics prove out on 1-2 pilot clients.

Pilot on ONE client for 3-4 weeks before generalising.

## 8. Cost sketch (verify all vendor pricing first)
- Nano Banana API: pennies per image (~$0.03-0.15/image); even 500 images/week is trivial.
- Creatomate: ~$54/mo subscription (render credits). Confirmed as gettable by Seb.
- Trendtrack: ALREADY PAID by Seb (no new cost). Listed tiers $47/$71/$119/mo for reference.
- Higgsfield: pricing refuted in research, confirm directly. Defer to phase 5 anyway.
- Agent runs: Sonnet-class weekly per client, small.
Net NEW tooling cost to launch statics: ~$54/mo Creatomate + per-image Nano Banana. Trendtrack is already covered. Fully-loaded creative production cost per client stays low-hundreds £/mo vs £2-5k/mo human design equivalent: that margin is the business case.

## 9. Open decisions for Seb
1. Pilot client for phase 1-3? (STILL OPEN)
2. ~~Client-facing asset approval or internal-only?~~ **DECIDED: internal-only.** Team is the sole quality gate.
3. ~~Direct Meta push or file delivery?~~ **DECIDED: file delivery only.** Files land in the client Drive folder; media buyer uploads manually. Note: naming convention must survive the manual upload so the Layer 4 performance loop can still match assets to live ads.
4. ~~Foreplay now or phase 4?~~ **DECIDED: use Trendtrack (already paid), not Foreplay. Wire its MCP in from day one.**
