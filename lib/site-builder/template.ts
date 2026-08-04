// Renders a single self-contained HTML file for the demo site. No build step
// and no CSS framework, so all styling is hand-written and inlined (the
// Tailwind Play CDN flashes unstyled content and is dev-only).
//
// Design intent: this page has to look like a studio built it, because a
// prospect is shown it live and asked for two thousand pounds. That means
// every section uses a DIFFERENT layout, not one card grid repeated. Order:
//   hero (split, form on the right)  ->  marquee ticker  ->  editorial
//   numbered service list  ->  asymmetric about + sticky heading  ->  dark
//   stat band  ->  bento gallery  ->  process timeline  ->  pull-quote  ->
//   flowing areas list  ->  FAQ accordion  ->  full-bleed dark CTA.

import type { SiteDesign } from './design'

export type Testimonial = { quote: string; location: string; source: string }
export type Founder = { name: string; role: string; credentials: string | null }
export type Stat = { value: string; label: string }

// Per-client art direction. The model picks a palette from the copy brief, but
// when a business has a real logo the site should look like their brand, not
// like the last one off the line. Anything set here overrides the generated
// design, so two roofers never arrive looking like the same page recoloured.
export type SiteStyle = {
  palette?: Partial<SiteDesign['palette']>
  font?: { family: string; css: string; weight: string; italic: boolean }
  radius?: string        // card/figure corners
  buttonRadius?: string  // 100px reads friendly, 6px reads industrial
  heroFlip?: boolean     // quote form on the left instead of the right
  logoUrl?: string       // e.g. their logo re-cropped and inlined as a data URI
  logoHeight?: string    // tall stacked logos need more than the 44px default
  headerAlwaysSolid?: boolean // for logos that need a light background to read
}

export type TemplateInput = {
  businessName: string
  legalName: string
  monogram: string
  niche: string
  city: string | null
  phone: string | null
  address: string | null
  photos: string[]
  logoUrl: string | null
  rating: number | null
  reviewCount: number | null
  testimonials: Testimonial[]
  founder: Founder | null
  stats: Stat[]
  buildId: string
  design: SiteDesign
  style?: SiteStyle
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Per-niche display face, so a roofer and a salon do not arrive looking like
// the same template with different colours. Body stays Inter everywhere: it
// is the right tool for body copy, the old build's mistake was using it for
// display type too.
const FONTS: Record<SiteDesign['niche_category'], { family: string; css: string; weight: string; italic: boolean }> = {
  trades: { family: "'Bricolage Grotesque'", css: 'Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800', weight: '800', italic: false },
  hospitality: { family: "'Instrument Serif'", css: 'Instrument+Serif:ital@0;1', weight: '400', italic: true },
  professional: { family: "'Fraunces'", css: 'Fraunces:opsz,wght@9..144,600;9..144,700', weight: '700', italic: false },
  beauty_wellness: { family: "'Cormorant Garamond'", css: 'Cormorant+Garamond:wght@400;600', weight: '600', italic: false },
  retail: { family: "'Space Grotesk'", css: 'Space+Grotesk:wght@500;700', weight: '700', italic: false },
  generic: { family: "'Archivo'", css: 'Archivo:wght@600;700;800', weight: '800', italic: false },
}

function starRow(rating: number, size = 15): string {
  const full = Math.round(rating)
  return Array.from({ length: 5 }, (_, i) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${i < full ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
  ).join('')
}

export function renderSiteHtml(input: TemplateInput): string {
  const { design } = input
  const style = input.style || {}
  const { primary, accent, ink, surface, surface_alt } = { ...design.palette, ...style.palette }
  const font = style.font || FONTS[design.niche_category] || FONTS.generic
  const radius = style.radius || '18px'
  const logoUrl = style.logoUrl || input.logoUrl
  // The model sometimes writes a phone-first CTA ("Call Chris Now"). That reads
  // wrong on a button that scrolls to a form or submits one, so anything
  // pointing at the form gets a form-shaped label instead.
  const formCta = /\bcall\b/i.test(design.cta_text) ? 'Get My Free Quote' : design.cta_text
  const btnRadius = style.buttonRadius || '100px'
  const phoneHref = input.phone ? `tel:${input.phone.replace(/[^\d+]/g, '')}` : null
  const hasRating = input.rating != null && input.reviewCount != null
  const name = input.businessName

  const heroPhoto = input.photos[0] || null
  const gallery = input.photos.slice(1, 6)

  const jobTypes = (design.services.length ? design.services : [{ name: 'General enquiry', description: '' }])
    .map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('')

  // Marquee content is duplicated so the CSS loop has no visible seam.
  const tickerItems = [...design.trust_badges, ...(input.city ? [`Covering ${input.city}`] : [])]
  const ticker = [...tickerItems, ...tickerItems]
    .map(t => `<span class="tick">${esc(t)}</span>`).join('')

  const servicesHtml = design.services.map((s, i) => `
    <a class="srv" href="#quote">
      <span class="srv-n">${String(i + 1).padStart(2, '0')}</span>
      <span class="srv-name">${esc(s.name)}</span>
      <span class="srv-desc">${esc(s.description)}</span>
      <span class="srv-arrow" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg>
      </span>
    </a>`).join('')

  const whyHtml = design.why_choose.map((w, i) => `
    <div class="why-item reveal" style="--d:${i * 60}ms">
      <span class="why-num">${String(i + 1).padStart(2, '0')}</span>
      <div>
        <h3>${esc(w.title)}</h3>
        <p>${esc(w.description)}</p>
      </div>
    </div>`).join('')

  const statsHtml = input.stats.length
    ? `<section class="stats">
        <div class="wrap stats-grid">
          ${input.stats.map(s => `
            <div class="stat reveal">
              <div class="stat-v">${esc(s.value)}</div>
              <div class="stat-l">${esc(s.label)}</div>
            </div>`).join('')}
        </div>
      </section>`
    : ''

  // Bento spans are derived from the actual photo count so the grid never
  // leaves a hole; Google listings routinely return 1 to 5 usable photos.
  const BENTO: Record<number, string[]> = {
    1: ['4 / 2'],
    2: ['2 / 2', '2 / 2'],
    3: ['2 / 2', '2 / 1', '2 / 1'],
    4: ['2 / 2', '2 / 1', '1 / 1', '1 / 1'],
    5: ['2 / 2', '2 / 1', '1 / 1', '1 / 1', '2 / 1'],
  }
  const spans = BENTO[Math.min(gallery.length, 5)] || []
  const galleryHtml = gallery.length
    ? `<section class="section">
        <div class="wrap">
          <div class="sec-head">
            <span class="label">Recent work</span>
            <h2 class="h2">${input.city ? `On the tools in ${esc(input.city)}` : 'Recent jobs'}</h2>
          </div>
          <div class="bento">
            ${gallery.map((src, i) => {
              const [c, r] = (spans[i] || '1 / 1').split(' / ')
              return `<figure class="reveal" style="grid-column:span ${c};grid-row:span ${r}"><img src="${esc(src)}" alt="Completed job" loading="lazy" /></figure>`
            }).join('')}
          </div>
        </div>
      </section>`
    : ''

  const processHtml = `
    <section class="section alt">
      <div class="wrap">
        <div class="sec-head">
          <span class="label">How it works</span>
          <h2 class="h2">From first call to signed off</h2>
        </div>
        <div class="steps">
          ${design.process.map(p => `
            <div class="step reveal">
              <div class="step-n">${p.step}</div>
              <h4>${esc(p.title)}</h4>
              <p>${esc(p.description)}</p>
            </div>`).join('')}
        </div>
      </div>
    </section>`

  const quoteHtml = input.testimonials.length
    ? `<section class="pull">
        <div class="wrap narrow center">
          ${hasRating ? `<div class="pull-stars">${starRow(input.rating!, 18)}</div>` : ''}
          <blockquote class="pull-q">&ldquo;${esc(input.testimonials[0].quote)}&rdquo;</blockquote>
          <span class="pull-src">${esc(input.testimonials[0].source)}${input.testimonials[0].location ? ` &middot; ${esc(input.testimonials[0].location)}` : ''}</span>
        </div>
      </section>`
    : ''

  const areasHtml = design.service_areas.length
    ? `<section class="section">
        <div class="wrap">
          <div class="sec-head">
            <span class="label">Where we work</span>
          </div>
          <p class="areas">${design.service_areas.map(a => `<span>${esc(a)}</span>`).join('<i>·</i>')}</p>
        </div>
      </section>`
    : ''

  const faqHtml = design.faqs.length
    ? `<section class="section alt">
        <div class="wrap faq-layout">
          <div class="sec-head sticky">
            <span class="label">Questions</span>
            <h2 class="h2">Things people ask</h2>
          </div>
          <div>
            ${design.faqs.map(f => `
              <details class="faq">
                <summary><span>${esc(f.q)}</span><i></i></summary>
                <p>${esc(f.a)}</p>
              </details>`).join('')}
          </div>
        </div>
      </section>`
    : ''

  const brandMark = logoUrl
    ? `<span class="logo-chip"><img src="${esc(logoUrl)}" alt="${esc(name)}" class="logo-img" /></span>`
    : `<span class="mark">${esc(input.monogram)}</span><span class="wordmark">${esc(name)}</span>`

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: input.legalName,
    ...(input.phone ? { telephone: input.phone } : {}),
    ...(input.address ? { address: input.address } : {}),
    ...(hasRating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: input.rating, reviewCount: input.reviewCount } } : {}),
  })

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(name)} | ${esc(design.eyebrow)}</title>
<meta name="description" content="${esc(design.hero_subhead)}" />
<meta property="og:title" content="${esc(name)} | ${esc(design.hero_headline)}" />
<meta property="og:description" content="${esc(design.hero_subhead)}" />
${heroPhoto ? `<meta property="og:image" content="${esc(heroPhoto)}" />` : ''}
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${accent}'/><text x='16' y='22' font-size='15' font-weight='bold' font-family='sans-serif' fill='white' text-anchor='middle'>${input.monogram}</text></svg>`)}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=${font.css}&display=swap" rel="stylesheet">
<script type="application/ld+json">${jsonLd}</script>
<style>
  :root{--primary:${primary};--accent:${accent};--ink:${ink};--surface:${surface};--alt:${surface_alt};--display:${font.family},serif;--r:${radius};--btn-r:${btnRadius}}
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth;overflow-x:hidden}
  body{font-family:'Inter',system-ui,sans-serif;background:var(--surface);color:var(--ink);-webkit-font-smoothing:antialiased;font-size:16px;line-height:1.6;overflow-x:hidden;max-width:100vw}
  img{max-width:100%;display:block}
  a{color:inherit;text-decoration:none}
  /* min-width:0 everywhere a flex/grid child holds text: the default
     min-width:auto refuses to shrink below content size, which pushed the
     hero headline past the viewport on narrow screens. */
  .wrap{max-width:1180px;margin:0 auto;padding:0 24px;width:100%;min-width:0}
  .hero .wrap>*,.split>*,.faq-layout>*,.srv>*{min-width:0}
  .wrap.narrow{max-width:800px}
  .center{text-align:center}

  /* type */
  .h1{font-family:var(--display);font-weight:${font.weight};${font.italic ? 'font-style:italic;' : ''}font-size:clamp(38px,6.6vw,82px);line-height:0.98;letter-spacing:-0.035em;overflow-wrap:break-word}
  .h2{font-family:var(--display);font-weight:${font.weight};${font.italic ? 'font-style:italic;' : ''}font-size:clamp(28px,3.6vw,46px);line-height:1.05;letter-spacing:-0.03em}
  .label{display:inline-block;font-size:11.5px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
  .sec-head{margin-bottom:44px;max-width:640px}
  .lede{font-size:17px;opacity:.7;max-width:560px}

  /* buttons */
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;border-radius:var(--btn-r);padding:15px 28px;font-weight:600;font-size:15px;border:none;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,background .18s ease;font-family:inherit}
  .btn-accent{background:var(--accent);color:#fff;box-shadow:0 6px 20px color-mix(in srgb,var(--accent) 38%,transparent)}
  .btn-accent:hover{transform:translateY(-2px);box-shadow:0 12px 30px color-mix(in srgb,var(--accent) 46%,transparent)}
  .btn-ghost{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.28);backdrop-filter:blur(6px)}
  .btn-ghost:hover{background:rgba(255,255,255,.16)}

  /* emergency + header: stacked inside one fixed bar so the header can never
     sit on top of the strip and clip the logo */
  .topbar{position:fixed;top:0;left:0;right:0;z-index:50}
  .emg{background:var(--ink);color:#fff;text-align:center;font-size:13px;font-weight:500;padding:10px 16px}
  .emg a{color:#fff;text-decoration:underline;text-underline-offset:3px;margin-left:8px;font-weight:600}
  header{transition:background .3s ease,box-shadow .3s ease,padding .3s ease;padding:18px 0}
  header.solid{background:rgba(255,255,255,.92);backdrop-filter:blur(14px);box-shadow:0 1px 0 rgba(0,0,0,.07);padding:11px 0}
  header .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}
  .brand{display:flex;align-items:center;gap:11px;min-width:0}
  .mark{width:38px;height:38px;border-radius:calc(var(--r) - 7px);background:var(--accent);color:#fff;display:grid;place-items:center;font-family:var(--display);font-weight:${font.weight};font-size:17px;flex-shrink:0;letter-spacing:-.02em}
  .wordmark{font-family:var(--display);font-weight:${font.weight};font-size:19px;letter-spacing:-.025em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  header.solid .wordmark{color:var(--ink)}
  /* Real logos often ship with a background baked in, so they get a neutral
     chip that reads on both the transparent-over-hero and solid header. */
  .logo-chip{background:#fff;border-radius:calc(var(--r) - 6px);padding:7px 12px;display:flex;align-items:center;box-shadow:0 2px 12px rgba(0,0,0,.14)}
  .logo-img{height:${style.logoHeight || '44px'};width:auto;max-width:230px;object-fit:contain;display:block}
  .hdr-r{display:flex;align-items:center;gap:12px;flex-shrink:0}
  /* Phone in the header is the single highest-converting element for local
     trades (calls convert ~46% vs ~2% for forms), so it stays, but styled as
     a deliberate pill rather than a bare text link. */
  .hdr-tel{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:14.5px;color:#fff;padding:9px 16px;border-radius:var(--btn-r);border:1px solid rgba(255,255,255,.3);transition:background .2s}
  .hdr-tel:hover{background:rgba(255,255,255,.14)}
  header.solid .hdr-tel{color:var(--ink);border-color:rgba(0,0,0,.16)}
  header.solid .hdr-tel:hover{background:rgba(0,0,0,.05)}

  /* hero: split, form on the right */
  /* Top padding tracks the real topbar height (set from JS), because the
     emergency strip wraps to two lines on narrow screens and a hardcoded
     value pushes the hero copy underneath it. */
  .hero{position:relative;min-height:92vh;display:flex;align-items:center;padding:calc(var(--topbar-h,86px) + 60px) 0 80px;overflow:hidden;background:var(--primary)}
  /* Real Google Business photos are often phone snaps in poor light; a small
     lift stops the hero reading as muddy without looking processed. */
  .hero-bg{position:absolute;inset:0;background-size:cover;background-position:center;transform:scale(1.04);filter:brightness(1.12) saturate(1.06) contrast(1.03)}
  .hero-veil{position:absolute;inset:0;background:linear-gradient(105deg,color-mix(in srgb,var(--primary) 93%,transparent) 0%,color-mix(in srgb,var(--primary) 78%,transparent) 46%,color-mix(in srgb,var(--primary) 55%,transparent) 100%)}
  .hero-glow{position:absolute;width:520px;height:520px;border-radius:50%;background:var(--accent);filter:blur(150px);opacity:.28;top:-160px;right:-100px}
  .hero .wrap{position:relative;display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
  .hero-l{color:#fff;max-width:620px}
  .hero-l .label{color:color-mix(in srgb,var(--accent) 70%,#fff)}
  .hero-l .h1{color:#fff;margin-bottom:20px}
  .hero-sub{font-size:clamp(15.5px,1.6vw,18.5px);opacity:.82;max-width:520px;margin-bottom:30px}
  .hero-pts{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:34px}
  .hero-pts span{display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:500;color:rgba(255,255,255,.9);background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);padding:8px 15px;border-radius:var(--btn-r);backdrop-filter:blur(6px)}
  .hero-pts svg{color:var(--accent)}
  .hero-ctas{display:flex;gap:12px;flex-wrap:wrap}
  .rate{display:inline-flex;align-items:center;gap:9px;margin-bottom:18px;font-size:13.5px;font-weight:600;color:#fff}
  .rate .stars{color:var(--accent);display:inline-flex;gap:1px}

  /* hero form card */
  .fcard{background:#fff;border-radius:calc(var(--r) + 6px);padding:30px;box-shadow:0 30px 70px rgba(0,0,0,.32);max-width:430px;justify-self:end;width:100%}
  .fcard h3{font-family:var(--display);font-weight:${font.weight};font-size:24px;letter-spacing:-.025em;margin-bottom:5px;line-height:1.1}
  .fcard .fsub{font-size:13.5px;opacity:.6;margin-bottom:20px}
  .fld{margin-bottom:13px}
  .fld label{display:block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;opacity:.5;margin-bottom:6px}
  .fld input,.fld select{width:100%;padding:13px 15px;border-radius:calc(var(--r) - 6px);border:1.5px solid rgba(0,0,0,.11);font-family:inherit;font-size:15px;background:#fff;color:var(--ink);transition:border-color .18s,box-shadow .18s}
  .fld input:focus,.fld select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 15%,transparent)}
  .fcard .btn{width:100%;margin-top:6px}
  .fnote{font-size:11.5px;opacity:.5;text-align:center;margin-top:12px}
  .fdone{display:none;text-align:center;padding:34px 10px}
  .fdone.on{display:block}
  .fdone .tickmark{width:52px;height:52px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;margin:0 auto 16px}
  .fdone h3{margin-bottom:6px}

  /* marquee */
  .marq{background:var(--ink);color:#fff;padding:15px 0;overflow:hidden;white-space:nowrap}
  .marq-in{display:inline-flex;align-items:center;animation:slide 32s linear infinite}
  .tick{display:inline-flex;align-items:center;font-size:13px;font-weight:500;letter-spacing:.02em;padding:0 26px;opacity:.92}
  .tick::after{content:'';width:5px;height:5px;border-radius:50%;background:var(--accent);margin-left:26px}
  @keyframes slide{from{transform:translateX(0)}to{transform:translateX(-50%)}}

  /* sections */
  .section{padding:clamp(64px,8vw,110px) 0}
  .section.alt{background:var(--alt)}

  /* editorial service list, no cards */
  .srv{display:grid;grid-template-columns:64px 1.1fr 1.5fr 40px;gap:20px;align-items:center;padding:26px 0;border-top:1px solid rgba(0,0,0,.1);transition:padding-left .28s ease,background .28s ease}
  .srv:last-child{border-bottom:1px solid rgba(0,0,0,.1)}
  .srv:hover{padding-left:16px;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 7%,transparent),transparent 60%)}
  .srv-n{font-family:var(--display);font-size:15px;font-weight:${font.weight};color:var(--accent);opacity:.8}
  .srv-name{font-family:var(--display);font-weight:${font.weight};font-size:clamp(20px,2.3vw,29px);letter-spacing:-.028em;line-height:1.1}
  .srv-desc{font-size:15px;opacity:.62;line-height:1.55}
  .srv-arrow{color:var(--accent);opacity:0;transform:translateX(-8px);transition:all .28s ease}
  .srv:hover .srv-arrow{opacity:1;transform:translateX(0)}

  /* about: asymmetric, sticky heading */
  .split{display:grid;grid-template-columns:.85fr 1.15fr;gap:60px;align-items:start}
  .sticky{position:sticky;top:110px}
  .why-item{display:flex;gap:18px;padding:22px 0;border-bottom:1px solid rgba(0,0,0,.09)}
  .why-item:last-child{border-bottom:none}
  .why-num{font-family:var(--display);font-size:13px;font-weight:${font.weight};color:var(--accent);padding-top:4px;flex-shrink:0}
  .why-item h3{font-family:var(--display);font-weight:${font.weight};font-size:19px;letter-spacing:-.02em;margin-bottom:5px}
  .why-item p{font-size:14.5px;opacity:.62;line-height:1.55}
  .about-p{font-size:17px;line-height:1.65;opacity:.72;margin-bottom:22px}

  /* dark stat band */
  .stats{background:var(--primary);color:#fff;padding:clamp(48px,6vw,76px) 0}
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:34px}
  .stat-v{font-family:var(--display);font-weight:${font.weight};font-size:clamp(34px,4.4vw,54px);letter-spacing:-.035em;line-height:1;color:#fff;margin-bottom:8px}
  .stat-l{font-size:13px;opacity:.62;letter-spacing:.04em}

  /* bento gallery */
  .bento{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:170px;gap:14px}
  .bento figure{overflow:hidden;border-radius:var(--r);background:var(--alt)}
  .bento img{width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.2,.7,.3,1)}
  .bento figure:hover img{transform:scale(1.06)}

  /* process */
  .steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:30px;position:relative}
  .step-n{font-family:var(--display);font-weight:${font.weight};font-size:52px;line-height:1;color:var(--accent);opacity:.22;margin-bottom:10px;letter-spacing:-.04em}
  .step h4{font-family:var(--display);font-weight:${font.weight};font-size:18px;letter-spacing:-.02em;margin-bottom:6px}
  .step p{font-size:14.5px;opacity:.62}

  /* pull quote */
  .pull{padding:clamp(64px,8vw,104px) 0;background:var(--alt)}
  .pull-stars{color:var(--accent);display:inline-flex;gap:2px;margin-bottom:20px}
  .pull-q{font-family:var(--display);font-weight:${font.weight};${font.italic ? 'font-style:italic;' : ''}font-size:clamp(22px,3vw,36px);line-height:1.28;letter-spacing:-.025em;margin-bottom:20px}
  .pull-src{font-size:13.5px;opacity:.55;letter-spacing:.03em}

  /* areas as flowing text */
  .areas{font-family:var(--display);font-weight:${font.weight};font-size:clamp(20px,2.6vw,34px);line-height:1.45;letter-spacing:-.025em}
  /* Place names wrap as whole units, never split across lines. */
  .areas span{white-space:nowrap}
  .areas i{color:var(--accent);font-style:normal;margin:0 12px;opacity:.55}

  /* faq */
  .faq-layout{display:grid;grid-template-columns:.8fr 1.2fr;gap:56px;align-items:start}
  .faq{border-bottom:1px solid rgba(0,0,0,.1)}
  .faq summary{display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer;padding:20px 0;font-weight:600;font-size:16.5px;list-style:none}
  .faq summary::-webkit-details-marker{display:none}
  .faq summary i{width:20px;height:20px;position:relative;flex-shrink:0}
  .faq summary i::before,.faq summary i::after{content:'';position:absolute;background:var(--accent);border-radius:2px;transition:transform .25s ease}
  .faq summary i::before{top:9px;left:0;width:20px;height:2px}
  .faq summary i::after{left:9px;top:0;width:2px;height:20px}
  .faq[open] summary i::after{transform:rotate(90deg)}
  .faq p{font-size:15px;opacity:.65;padding-bottom:20px;max-width:620px}

  /* final cta */
  .cta{position:relative;background:var(--primary);color:#fff;padding:clamp(72px,9vw,124px) 0;overflow:hidden;text-align:center}
  .cta-bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.2}
  .cta-glow{position:absolute;width:600px;height:600px;border-radius:50%;background:var(--accent);filter:blur(160px);opacity:.26;bottom:-300px;left:50%;transform:translateX(-50%)}
  .cta .wrap{position:relative}
  .cta .h2{color:#fff;margin-bottom:16px}
  .cta p{opacity:.75;margin-bottom:30px;font-size:16.5px}
  .cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}

  footer{padding:34px 0 40px;border-top:1px solid rgba(0,0,0,.09)}
  footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;font-size:13px;opacity:.5}

  .reveal{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.2,.7,.3,1) var(--d,0ms),transform .7s cubic-bezier(.2,.7,.3,1) var(--d,0ms)}
  .reveal.in{opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none}.marq-in{animation:none}}

  /* Sits bottom-left: a top-right corner ribbon always collided with the
     header CTA, which is the one button the prospect is meant to notice. */
  .demo-tag{position:fixed;left:18px;bottom:18px;z-index:70;display:inline-flex;align-items:center;gap:7px;background:rgba(20,20,20,.82);color:#fff;backdrop-filter:blur(8px);font-size:11px;font-weight:600;letter-spacing:.09em;padding:8px 14px;border-radius:var(--btn-r);border:1px solid rgba(255,255,255,.16)}
  .demo-tag::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--accent)}
  .sticky-m{display:none}

  @media (max-width:960px){
    .hero .wrap{grid-template-columns:1fr;gap:40px}
    .fcard{justify-self:stretch;max-width:none}
    .split,.faq-layout{grid-template-columns:1fr;gap:34px}
    .sticky{position:static}
    .srv{grid-template-columns:40px 1fr;gap:8px 16px}
    .srv-desc{grid-column:2;font-size:14px}
    .srv-arrow{display:none}
    .bento{grid-template-columns:repeat(2,1fr);grid-auto-rows:135px}
    .bento .b0{grid-column:span 2;grid-row:span 2}
    .bento .b1,.bento .b4{grid-column:span 2}
  }
  @media (max-width:700px){
    .hero{min-height:auto;padding:calc(var(--topbar-h,86px) + 34px) 0 60px}
    .wrap{padding:0 18px}
    .emg{font-size:12px;padding:8px 14px}
    header{padding:12px 0}
    .hdr-tel span{display:none}
    .hdr-tel{padding:10px}
    .logo-img{height:32px;max-width:140px}
    .logo-chip{padding:5px 9px;border-radius:10px}
    .hdr-r{gap:8px}
    .hdr-r .btn{padding:12px 16px;font-size:14px}
    .h1{font-size:clamp(34px,10vw,46px)}
    .demo-tag{bottom:74px;left:12px;font-size:10px;padding:6px 11px}
    body{padding-bottom:66px}
    .sticky-m{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:65;background:#fff;box-shadow:0 -4px 24px rgba(0,0,0,.14)}
    .sticky-m a{flex:1;min-width:0;text-align:center;padding:17px 6px;font-weight:600;font-size:14px;display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap}
    .sticky-m .c{background:var(--ink);color:#fff}
    .sticky-m .q{background:var(--accent);color:#fff}
  }

  /* per-client art direction overrides, last so they always win */
  ${style.heroFlip ? `
  /* Scoped to desktop: these rules sit after the responsive block, so an
     unscoped two-column rule here would override the mobile collapse and
     push the hero off the side of the screen. */
  @media (min-width:961px){
    .hero .wrap{grid-template-columns:.95fr 1.05fr}
    .hero-l{order:2}
    .fcard{order:1;justify-self:start}
  }
  .hero-veil{background:linear-gradient(255deg,color-mix(in srgb,var(--primary) 93%,transparent) 0%,color-mix(in srgb,var(--primary) 78%,transparent) 46%,color-mix(in srgb,var(--primary) 55%,transparent) 100%)}
  .hero-glow{right:auto;left:-120px}
  /* On mobile the columns collapse, and the pitch has to come before the form. */
  @media (max-width:960px){.hero-l{order:1}.fcard{order:2}}` : ''}
  ${style.headerAlwaysSolid ? `
  header{background:rgba(255,255,255,.94);backdrop-filter:blur(14px);box-shadow:0 1px 0 rgba(0,0,0,.08)}
  .wordmark,.hdr-tel{color:var(--ink)}
  .hdr-tel{border-color:rgba(0,0,0,.16)}
  .hdr-tel:hover{background:rgba(0,0,0,.05)}
  .logo-chip{box-shadow:none;padding:0;background:transparent}` : ''}
</style>
</head>
<body>
<div class="demo-tag">DEMO PREVIEW</div>

<div class="topbar">
${design.emergency_strip.enabled ? `<div class="emg">${esc(design.emergency_strip.text)}${phoneHref ? `<a href="${phoneHref}">Call now</a>` : ''}</div>` : ''}

<header id="hdr">
  <div class="wrap">
    <div class="brand">${brandMark}</div>
    <div class="hdr-r">
      ${phoneHref ? `<a href="${phoneHref}" class="hdr-tel">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <span>${esc(input.phone!)}</span>
      </a>` : ''}
      <a href="#quote" class="btn btn-accent">${esc(formCta)}</a>
    </div>
  </div>
</header>
</div>

<section class="hero">
  ${heroPhoto ? `<div class="hero-bg" style="background-image:url('${esc(heroPhoto)}')"></div>` : ''}
  <div class="hero-veil"></div>
  <div class="hero-glow"></div>
  <div class="wrap">
    <div class="hero-l">
      ${hasRating
        ? `<div class="rate"><span class="stars">${starRow(input.rating!)}</span> ${input.rating!.toFixed(1)} from ${input.reviewCount} Google reviews</div>`
        : `<span class="label">${esc(design.eyebrow)}</span>`}
      <h1 class="h1">${esc(design.hero_headline)}</h1>
      <p class="hero-sub">${esc(design.hero_subhead)}</p>
      <div class="hero-pts">
        ${design.hero_points.map(p => `<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>${esc(p)}</span>`).join('')}
      </div>
      <div class="hero-ctas">
        ${phoneHref ? `<a href="${phoneHref}" class="btn btn-accent">Call ${esc(input.phone!)}</a>` : `<a href="#quote" class="btn btn-accent">${esc(formCta)}</a>`}
        <a href="#quote" class="btn btn-ghost">${esc(formCta)}</a>
      </div>
    </div>

    <div class="fcard" id="quote">
      <form id="lead-form">
        <input type="hidden" name="build_id" value="${esc(input.buildId)}" />
        <h3>Get a free quote</h3>
        <p class="fsub">No obligation. We reply the same day.</p>
        <div class="fld"><label>Name</label><input type="text" name="name" required autocomplete="name" /></div>
        <div class="fld"><label>Phone</label><input type="tel" name="phone" required autocomplete="tel" /></div>
        <div class="fld"><label>Postcode</label><input type="text" name="postcode" autocomplete="postal-code" /></div>
        <div class="fld"><label>What do you need?</label><select name="job_type">${jobTypes}</select></div>
        <button type="submit" class="btn btn-accent">${esc(formCta)}</button>
        <p class="fnote">We never share your details.</p>
      </form>
      <div class="fdone" id="lead-done">
        <div class="tickmark"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg></div>
        <h3>Got it</h3>
        <p class="fsub">${esc(name)} will be in touch shortly.</p>
      </div>
    </div>
  </div>
</section>

<div class="marq"><div class="marq-in">${ticker}</div></div>

<section class="section">
  <div class="wrap">
    <div class="sec-head">
      <span class="label">What we do</span>
      <h2 class="h2">Services</h2>
    </div>
    <div class="srv-list">${servicesHtml}</div>
  </div>
</section>

<section class="section alt">
  <div class="wrap split">
    <div class="sec-head sticky">
      <span class="label">Why ${esc(name)}</span>
      <h2 class="h2">${esc(design.about_heading)}</h2>
    </div>
    <div>
      <p class="about-p">${esc(design.about)}</p>
      ${whyHtml}
    </div>
  </div>
</section>

${statsHtml}
${galleryHtml}
${processHtml}
${quoteHtml}
${areasHtml}
${faqHtml}

<section class="cta">
  ${heroPhoto ? `<div class="cta-bg" style="background-image:url('${esc(heroPhoto)}')"></div>` : ''}
  <div class="cta-glow"></div>
  <div class="wrap">
    <h2 class="h2">${esc(design.cta_headline)}</h2>
    <p>${phoneHref ? `Call ${esc(input.phone!)} or send your details over.` : 'Send your details over and we will come back to you.'}</p>
    <div class="cta-btns">
      ${phoneHref ? `<a href="${phoneHref}" class="btn btn-accent">Call ${esc(input.phone!)}</a>` : ''}
      <a href="#quote" class="btn btn-ghost">${esc(formCta)}</a>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <span>${esc(input.legalName)}${input.address ? ` &middot; ${esc(input.address)}` : ''}</span>
    <span>Website by August Marketing</span>
  </div>
</footer>

${phoneHref ? `<div class="sticky-m">
  <a href="${phoneHref}" class="c"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Call now</a>
  <a href="#quote" class="q">${esc(formCta)}</a>
</div>` : ''}

<script>
(function(){
  var hdr=document.getElementById('hdr');
  var bar=document.querySelector('.topbar');
  var onScroll=function(){ hdr.classList.toggle('solid', window.scrollY>40); };
  onScroll(); window.addEventListener('scroll',onScroll,{passive:true});

  // The emergency strip wraps on narrow screens, so the topbar height is not
  // knowable up front. Publish it so the hero can pad itself correctly.
  var sizeBar=function(){
    if(!bar) return;
    document.documentElement.style.setProperty('--topbar-h', bar.offsetHeight+'px');
  };
  sizeBar();
  window.addEventListener('resize',sizeBar,{passive:true});
  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(sizeBar);}
  window.addEventListener('load',sizeBar);

  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    },{threshold:.12,rootMargin:'0px 0px -40px 0px'});
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in'); });
  }

  var form=document.getElementById('lead-form');
  if(!form) return;
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var data=Object.fromEntries(new FormData(form).entries());
    var btn=form.querySelector('button');
    btn.disabled=true; btn.textContent='Sending...';
    fetch('https://augustosv3.vercel.app/api/website-leads',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
    }).then(function(){
      form.style.display='none';
      document.getElementById('lead-done').classList.add('on');
    }).catch(function(){
      btn.disabled=false; btn.textContent='Try again';
    });
  });
})();
</script>

</body>
</html>`
}
