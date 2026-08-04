# Demo Site Engine v2 — audit + build spec

Audit of the v1 output (Peak Roofer, https://peak-roofer-vwadc-gw5xcvxqj-sebsanchezrs-projects.vercel.app/)
and the spec to take it from 2/10 to 9/10. Research-backed. Execute with Sonnet.

Files in scope: `lib/site-builder/{research,design,template,deploy,index}.ts`,
`app/api/websites/route.ts`, `app/api/websites/[id]/amend/route.ts`.

---

## Part 1 — Why v1 scores 2/10

Three root causes. Everything visible on the page traces back to one of them.

### Root cause 1: the research pass returns nothing, and every field collapses to a fallback

The caller pasted a Google Maps URL. `research.ts` does a plain `fetch()` on it. Verified result:

```
status: 200 | visible text length: 22,786 chars
contains "Barking": false   contains "IG11": false
contains "Hepworth": false  contains "roofer": false
```

Google Maps returns a JS shell. 22k characters of font CSS, zero business data. That text
gets fed to Haiku, which correctly extracts nothing. So `city`, `phone`, `service_area`
were all null, and the template collapsed:

| Slot | Rendered | Should have been |
|---|---|---|
| Header CTA | "Get in touch" → `#contact` | `Call 07551 601397` (tel:) |
| Hero subhead | "across the region" | "across Barking and East London" |
| Service area line | *omitted entirely* | "Serving Barking, IG11 and surrounding" |
| Final CTA | "Get in touch today" | "Call now on 07551 601397" |
| Footer | "Peak Roofer" | "Peak Roofer · Barking, IG11" |

**The address was sitting in the URL as plaintext the whole time** and was never parsed:
`.../place/Peak+roofer+ltd,+Hepworth+Gardens,+Barking+IG11+9AX/@51.5475533,0.1086385,...`

**The fix already exists in this repo and is unused.** `website_engine/apify_scrape.py::scrape_google`
was written for exactly this and was never ported to the TS pipeline. `APIFY_TOKEN` in
`lead_pipeline/.env` is **live** (plan STARTER, $19 of $170 used this month). Verified run
against Peak Roofer's actual Maps URL, cost ~1 cent, returned:

```
title:      Peak roofer ltd
phone:      +44 7551 601397
address:    Hepworth Gardens, Barking IG11 9AX, United Kingdom
city:       Barking          postcode: IG11 9AX
categories: ['Roofing contractor']
opening hours: yes
images:     5   ← real photos of their own work
rating/reviews: none (unrated listing — template must handle this gracefully)
```

Photos hotlink fine with no referer (`200 image/jpeg`, ~230KB), and the size suffix is
swappable: `...=w1920-h1080-k-no` → `=w1600-h900-k-no` returns 200. Filter to
`lh3.googleusercontent.com` only — `streetviewpixels-pa.googleapis.com` URLs 403.

### Root cause 2: the page has no conversion mechanism at all

Every CTA on the page points to `#contact`. `#contact` is a gradient band whose only
button also points to `#contact`. **It is a circular link loop.** There is no form, no
phone, no email. A prospect clicking any button on this site during a live sales call
gets nothing. That single fact caps the score regardless of styling.

Against the data: phone leads convert to booked jobs at **~46% vs ~2% for web forms**
(CallRail) and 60-70% of home-services conversions are calls. v1 has neither.

### Root cause 3: dark theme, and no slots for anything that converts

- **Dark is wrong for this niche.** Of the UK roofing sites researched, **zero** use a dark
  theme. The pattern is uniformly white/light body, navy text, one high-contrast accent.
  Dark mesh-gradients with blurred blobs read as SaaS/crypto — exactly the "don't make it
  look like a tech company" failure.
- **`SiteDesign` has no fields for photos, reviews, rating, accreditations, guarantees, or
  emergency treatment.** Even handed perfect data, the template has nowhere to put it.
- **No real photography.** A roofing site with no roofs. The icon-on-gradient panel reads
  as a placeholder. Real photos vs stock is worth ~+35% conversion (VWO/CXL).
- **Caller instructions are structurally impossible to honour.** The notes said "tabs for
  services… a full-scale website". The model can only fill fixed slots; it cannot add
  sections or pages. Instructions get silently dropped. Either widen the schema (below) or
  tell the caller what the form can actually action.
- **No social preview tags.** Zero `og:image`/`og:title`/favicon. When a caller pastes the
  link into WhatsApp or email, it renders as a naked URL with no card. Real sales problem.
- **Tailwind Play CDN** is a dev tool — it flashes unstyled content and logs a console
  warning. Speed matters: 1s pages convert ~3x vs 5s (Portent).

---

## Part 2 — What the best UK roofing sites actually do

From live teardowns of First Rate Roofing, HJR Roofing, Best Roofers Manchester,
Manchester Roof Repairs, Top Notch Roofers, plus LCCL/Visionary Lofts as premium trades.

Nine things the top sites share that v1 lacks:

1. **Phone as text in the header, click-to-call, and repeated inside the CTA button label.**
   Not "Contact Us" — literally `Call 07455 632326`.
2. **The subheadline is a proof stack, not a description.**
   Pattern: `{rating}. {ownership/longevity}. {guarantee}.`
   e.g. "4.9/5 Google rating. Family-run, three generations. 25-year guarantee on new roofs."
3. **A numeric review count beside the stars** — "5/5 from 700+", never a bare star row.
4. **Form is section 2, directly under the hero, 4-5 fields max** — or a multi-step whose
   first screen is a tappable job-type choice, not a text input.
5. **Sticky mobile call bar** persisting the whole scroll. 62-71% of home-services traffic
   is mobile; sticky click-to-call is worth **+25-40%**.
6. **A named human with a real photo and a credentials line** — founder card, not stock.
7. **Accreditation logos twice** — small greyscale row above the fold, full colour near the
   footer (NFRC, CompetentRoofer, TrustMark, Which? Trusted Trader, Checkatrade, CORC).
8. **24/7 emergency as a persistent strip above the nav**, not a service bullet.
   Emergency-modified terms convert 2.4x (Semrush).
9. **Geographic proof** — job photos captioned by town and property type, plus a service-area
   section listing named areas. Localised pages are worth ~+20%.

**Form field data (hardest numbers in the research):** 3 fields = 23.1% completion,
5 = 17.0%, 7 = 11.4%, 10+ = 6.9%. Non-linear cliff between 5 and 7 — **never exceed 5**.
Multi-step is +21% on lead-gen specifically. Star ratings above the fold: +15-25%.
Rating sweet spot is 4.0-4.7; a bare 5.0 reads as fake.

**Recurring section order to build:**
emergency strip → sticky header (logo, phone, Get Free Quote) → hero (H1 + proof-stack
subhead + real photo + dual CTA) → trust bar (rating/count/badges) → **quote form** →
why choose us → services grid → testimonials → 4-step process → gallery/before-after →
service areas → accreditations → FAQ → final CTA → footer. Sticky mobile call bar throughout.

---

## Part 3 — Build spec

### 3.1 Rewrite `research.ts` around Apify (highest leverage, do first)

Port `website_engine/apify_scrape.py::scrape_google`. Actor `compass~crawler-google-places`,
endpoint `POST /v2/acts/{actor}/run-sync-get-dataset-items?token=…`, input:

```json
{ "startUrls": [{"url": "<google_url>"}], "maxCrawledPlacesPerSearch": 1,
  "language": "en", "countryCode": "gb", "maxReviews": 10, "maxImages": 30 }
```

Fall back to `"searchStringsArray": ["<business_name> <city>"]` when there's no Maps URL.

- Add `APIFY_TOKEN` to `cold_call_os/.env.local` **and** Vercel production (copy the live
  value from `lead_pipeline/.env`).
- Also parse the Maps URL string itself as a zero-cost belt-and-braces fallback — business
  name, street, town and postcode are all in the `/place/<...>/` segment.
- Keep the existing HTML-scrape path for when the caller gives a real website URL instead.
- Return a widened type: `phone, address, city, postcode, rating, review_count, review_texts[],
  photos[], categories[], opening_hours, logo_url, founded_year, years_active`.
- Filter photos to `lh3.googleusercontent.com`; rewrite the size suffix per slot
  (`=w1600-h900-k-no` hero, `=w800-h600-k-no` gallery).
- Apify runs take 30-90s. This will not fit the current inline request. See 3.5.

**Fill the DB from this too.** If Apify returns a phone/city and the row is null, write it
back to `website_builds` — the caller then has the real number in the OS for the call.

### 3.2 Widen the `SiteDesign` schema

Add to the Sonnet JSON contract:

```
theme: 'light' (fixed for trades — do not let the model pick dark)
palette: { primary(navy), accent(high-contrast CTA), ink, surface, surface_alt }
emergency_strip: { enabled: bool, text: string }
proof_stack: string[]        // 3 items for the hero subhead
trust_bar: { rating, review_count, badges[] }
why_choose: [{ title, description }]        // 4-6
services: [{ name, description, icon_key }] // 6-9
process: [{ step, title, description }]     // 4
testimonials: [{ quote, author, location, source }]
service_areas: string[]      // 15-30 named towns/postcodes near their base
accreditations: string[]     // niche-appropriate, only ones plausibly real
faqs: [{ q, a }]             // 5-6
guarantee: string | null
founder: { name, role, credentials } | null
```

**Hard rule for the prompt: never invent a rating, review count, accreditation, or
testimonial.** If Apify returned none, the model must omit those blocks and the template
must render cleanly without them (Peak Roofer is exactly this case). A fabricated
"4.9/5 from 200 reviews" on a prospect's own business is a deal-killer on a live call.
Where real reviews exist, quote them; where they don't, lean on service-area coverage,
response time and guarantee copy instead.

### 3.3 Rebuild `template.ts`

Light theme, section order from Part 2. Non-negotiables:

- **Phone everywhere**: header text link, inside the primary CTA label, final CTA, footer,
  and a **fixed bottom sticky bar on mobile** (`Call {phone}` | `Get Quote`).
  If no phone was found, the form becomes the primary CTA and the sticky bar links to it.
- **A real working quote form, section 2.** Max 5 fields: Name, Phone, Postcode,
  Job type (select, from `services`), optional Message. Needs a real endpoint — see 3.4.
- **Real photos**: hero background, plus a gallery captioned by town and property type.
  When Apify returns none, fall back to a tasteful niche treatment, never a bare icon.
- Emergency strip above the nav when `emergency_strip.enabled`.
- Trust bar only renders blocks that have real data.
- `og:title`, `og:description`, `og:image` (first real photo), `twitter:card`, emoji or
  generated favicon, `schema.org` LocalBusiness JSON-LD.
- Keep the DEMO PREVIEW ribbon and `noindex`.
- **Drop the Tailwind Play CDN.** Inline a small hand-written CSS block instead — it kills
  the unstyled flash, removes a render-blocking third-party request and the console warning.
- Niche-differentiated look: trades ≠ hospitality ≠ professional. Vary type scale, section
  order weighting and imagery treatment per `niche_category`, not just the palette.

### 3.4 The form needs somewhere to go

Currently nothing exists (`website_leads` was specced in `WEBSITE_SERVICE_BUILD_PLAN.md`,
never built; `RESEND_API_KEY` is in root `.env` but not in `cold_call_os`).

Minimum viable: migration for `website_leads(id, build_id, name, phone, postcode, job_type,
message, created_at)`, a public `POST /api/website-leads` on the OS (CORS-open, rate-limited,
no auth), form posts there, success state says "Thanks, {business} will call you back".
Ping the webdev Discord on submit. Sells the "every enquiry hits your phone in seconds"
line honestly, and proves the site works when the prospect tests it on the call.

### 3.5 Move the build off the request thread

Apify (30-90s) + Sonnet + deploy will blow past the 60s `maxDuration`. Options, cheapest first:

1. Keep inline but raise `maxDuration` to 300 (needs Vercel Pro — Hobby caps at 60s).
2. **Recommended:** return `202` immediately with the row at `building`, run the pipeline in
   a background task, have the UI poll `GET /api/websites` every 5s. The status column
   already supports `building` → `built`; the UI already renders "Building…". Small change,
   no plan upgrade, and the caller watches it progress rather than staring at a spinner.

### 3.6 Amend must survive the schema change

`amend/route.ts` replays `site_design` back into the model. Widening the schema means old
rows have the narrow shape. Make the amend prompt tolerant of missing keys and backfill
defaults rather than erroring.

---

## Part 4 — Order of execution

1. `research.ts` → Apify + Maps-URL parsing + DB write-back. **Biggest single jump.**
   Verify against the real Peak Roofer URL: expect phone, Barking, IG11, 5 photos.
2. Async build + polling (3.5) — unblocks everything slower than 60s.
3. `SiteDesign` schema widening + the no-fabrication rule.
4. `template.ts` rebuild: light theme, real photos, phone everywhere, sticky mobile bar,
   quote form, OG tags, drop the Tailwind CDN.
5. `website_leads` + public endpoint so the form is real.
6. Re-run Peak Roofer end to end and compare against First Rate Roofing side by side.

**Definition of done:** on a phone, the Peak Roofer demo shows their real photos, their real
number as a tappable button in a sticky bar, "Barking" in the H1, a 5-field quote form that
actually submits, and no invented reviews. Pasted into WhatsApp it renders a proper preview card.

### Cost per site after this
Apify Google Places ~$0.01 + one Haiku + one Sonnet ≈ **2-4p per demo**, against a
£1,500-2,000 sale. Apify plan has ~$150/month headroom, roughly 1,500 lookups.
