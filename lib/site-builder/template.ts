// Renders a single self-contained HTML file for the demo site. No build step,
// no external CDN (Tailwind Play CDN flashes unstyled content and is dev-only)
// so all CSS is hand-written and inlined. Light theme throughout — no UK
// trades/local-business site researched uses dark, it reads as SaaS/crypto.

import type { SiteDesign } from './design'

export type Testimonial = { quote: string; location: string; source: string }
export type Founder = { name: string; role: string; credentials: string | null }

export type TemplateInput = {
  businessName: string
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
  buildId: string
  design: SiteDesign
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const NICHE_ICON: Record<SiteDesign['niche_category'], string> = {
  trades: '<path d="M3 12L12 4l9 8"/><path d="M6 10.5V20h12v-9.5"/><path d="M10 20v-5h4v5"/>',
  hospitality: '<path d="M4 3v18"/><path d="M4 3c0 3 3 3 3 6s-3 3-3 6"/><path d="M17 3v18"/><path d="M14 9h6"/><circle cx="17" cy="6" r="3"/>',
  professional: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
  beauty_wellness: '<path d="M12 2c2 3 4 5 4 8a4 4 0 0 1-8 0c0-3 2-5 4-8Z"/><path d="M12 14v8"/><path d="M8 22h8"/>',
  retail: '<path d="M6 2 3 7v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-3-5Z"/><path d="M3 7h18"/><path d="M9 11a3 3 0 0 0 6 0"/>',
  generic: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
}

function starRow(rating: number): string {
  const full = Math.round(rating)
  return Array.from({ length: 5 }, (_, i) =>
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="${i < full ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
  ).join('')
}

export function renderSiteHtml(input: TemplateInput): string {
  const { design } = input
  const { primary, accent, ink, surface, surface_alt } = design.palette
  const nicheIcon = NICHE_ICON[design.niche_category] || NICHE_ICON.generic
  const phoneHref = input.phone ? `tel:${input.phone.replace(/[^\d+]/g, '')}` : null
  const hasRealTrust = input.rating != null && input.reviewCount != null

  const heroPhoto = input.photos[0] || null
  const galleryPhotos = input.photos.slice(1, 5)

  const jobTypeOptions = (design.services.length ? design.services : [{ name: 'General enquiry', description: '' }])
    .map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('')

  const trustBadgesHtml = [
    ...(hasRealTrust ? [`<div class="trust-item"><span class="stars">${starRow(input.rating!)}</span><span>${input.rating!.toFixed(1)} · ${input.reviewCount} Google reviews</span></div>`] : []),
    ...design.trust_badges.map(t => `<div class="trust-item"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg><span>${esc(t)}</span></div>`),
  ].join('')

  const whyChooseHtml = design.why_choose.map(w => `
    <div class="card">
      <h3>${esc(w.title)}</h3>
      <p>${esc(w.description)}</p>
    </div>`).join('')

  const servicesHtml = design.services.map(s => `
    <div class="card">
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description)}</p>
    </div>`).join('')

  const processHtml = design.process.map(p => `
    <div class="process-step">
      <div class="process-num">${p.step}</div>
      <h4>${esc(p.title)}</h4>
      <p>${esc(p.description)}</p>
    </div>`).join('')

  const galleryHtml = galleryPhotos.length
    ? `<section class="section">
        <div class="wrap">
          <h2>Recent work</h2>
          ${input.city ? `<p class="muted">Jobs completed in and around ${esc(input.city)}</p>` : ''}
          <div class="gallery-grid">
            ${galleryPhotos.map(src => `<img src="${esc(src)}" alt="Completed job" loading="lazy" />`).join('')}
          </div>
        </div>
      </section>`
    : ''

  const testimonialsHtml = input.testimonials.length
    ? `<section class="section alt">
        <div class="wrap">
          <h2>What customers say</h2>
          <div class="testimonial-grid">
            ${input.testimonials.map(t => `
              <div class="testimonial-card">
                <p>&ldquo;${esc(t.quote)}&rdquo;</p>
                <span class="muted">${esc(t.source)}${t.location ? ` &middot; ${esc(t.location)}` : ''}</span>
              </div>`).join('')}
          </div>
        </div>
      </section>`
    : ''

  const founderHtml = input.founder
    ? `<div class="founder-card">
        <div class="founder-avatar">${esc(input.founder.name.charAt(0))}</div>
        <div>
          <strong>${esc(input.founder.name)}</strong>
          <span class="muted">${esc(input.founder.role)}${input.founder.credentials ? ` · ${esc(input.founder.credentials)}` : ''}</span>
        </div>
      </div>`
    : ''

  const serviceAreasHtml = design.service_areas.length
    ? `<section class="section">
        <div class="wrap center">
          <h2>Areas we cover</h2>
          <div class="chip-row">
            ${design.service_areas.map(a => `<span class="chip">${esc(a)}</span>`).join('')}
          </div>
        </div>
      </section>`
    : ''

  const faqHtml = design.faqs.length
    ? `<section class="section alt">
        <div class="wrap narrow">
          <h2>Frequently asked questions</h2>
          ${design.faqs.map(f => `
            <details class="faq">
              <summary>${esc(f.q)}</summary>
              <p>${esc(f.a)}</p>
            </details>`).join('')}
        </div>
      </section>`
    : ''

  const logoBlock = input.logoUrl
    ? `<img src="${esc(input.logoUrl)}" alt="${esc(input.businessName)}" class="logo-img" />`
    : `<span class="wordmark">${esc(input.businessName)}</span>`

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: input.businessName,
    ...(input.phone ? { telephone: input.phone } : {}),
    ...(input.address ? { address: input.address } : {}),
    ...(hasRealTrust ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: input.rating, reviewCount: input.reviewCount } } : {}),
  })

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(design.hero_headline)} | ${esc(input.businessName)}</title>
<meta name="description" content="${esc(design.hero_subhead)}" />
<meta property="og:title" content="${esc(input.businessName)}" />
<meta property="og:description" content="${esc(design.hero_subhead)}" />
${heroPhoto ? `<meta property="og:image" content="${esc(heroPhoto)}" />` : ''}
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='${primary}'/><text x='16' y='22' font-size='16' font-family='sans-serif' fill='white' text-anchor='middle'>${input.businessName.charAt(0)}</text></svg>`)}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@700;800&display=swap" rel="stylesheet">
<script type="application/ld+json">${jsonLd}</script>
<style>
  :root { --primary: ${primary}; --accent: ${accent}; --ink: ${ink}; --surface: ${surface}; --surface-alt: ${surface_alt}; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', sans-serif; background: var(--surface); color: var(--ink); -webkit-font-smoothing: antialiased; }
  h1, h2, h3, h4 { font-family: 'Manrope', sans-serif; margin: 0 0 .5em; color: var(--ink); }
  p { line-height: 1.6; margin: 0 0 1em; }
  a { color: inherit; text-decoration: none; }
  img { max-width: 100%; display: block; }
  .demo-ribbon { position: fixed; top: 14px; right: -42px; transform: rotate(45deg); background: var(--accent); color: #fff; font-size: 11px; font-weight: 700; padding: 4px 50px; z-index: 60; letter-spacing: 0.04em; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
  .wrap.narrow { max-width: 720px; }
  .wrap.center { text-align: center; }
  .btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 13px 26px; font-weight: 700; font-size: 15px; border: none; cursor: pointer; }
  .btn-accent { background: var(--accent); color: #fff; }
  .btn-outline { background: transparent; border: 1.5px solid rgba(0,0,0,0.15); color: var(--ink); }
  .emergency-strip { background: var(--ink); color: #fff; text-align: center; font-size: 13px; font-weight: 600; padding: 9px 16px; }
  .emergency-strip a { color: var(--accent); text-decoration: underline; margin-left: 6px; }
  header { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,0.92); backdrop-filter: blur(8px); border-bottom: 1px solid rgba(0,0,0,0.06); }
  header .wrap { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; padding-bottom: 12px; }
  .wordmark { font-family: 'Manrope', sans-serif; font-weight: 800; font-size: 19px; color: var(--primary); }
  .logo-img { height: 34px; width: auto; object-fit: contain; }
  .header-actions { display: flex; align-items: center; gap: 14px; }
  .header-phone { font-weight: 700; font-size: 14px; color: var(--primary); }
  .hero { position: relative; overflow: hidden; }
  .hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
  .hero-overlay { position: absolute; inset: 0; }
  .hero-noPhoto { background: radial-gradient(circle at 20% 20%, ${primary}22, transparent 45%), radial-gradient(circle at 85% 30%, ${accent}22, transparent 40%), var(--surface-alt); }
  .hero-inner { position: relative; padding: 64px 0 56px; text-align: center; }
  .hero-inner.with-photo { color: #fff; padding: 96px 0 76px; }
  .hero-inner.with-photo h1, .hero-inner.with-photo p { color: #fff; }
  .rating-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; margin-bottom: 18px; }
  .hero-noPhoto .rating-badge { background: #fff; border-color: rgba(0,0,0,0.1); color: var(--ink); }
  .stars { color: var(--accent); display: inline-flex; gap: 1px; }
  h1.headline { font-size: clamp(30px, 5vw, 52px); font-weight: 800; line-height: 1.1; max-width: 820px; margin: 0 auto 16px; }
  .subhead { font-size: 17px; opacity: 0.85; max-width: 620px; margin: 0 auto 30px; }
  .hero-ctas { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
  .trust-bar { background: var(--surface-alt); border-top: 1px solid rgba(0,0,0,0.05); border-bottom: 1px solid rgba(0,0,0,0.05); padding: 16px 0; }
  .trust-bar .wrap { display: flex; flex-wrap: wrap; gap: 10px 28px; justify-content: center; }
  .trust-item { display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 600; color: var(--ink); }
  .trust-item svg { color: var(--accent); flex-shrink: 0; }
  .section { padding: 64px 0; }
  .section.alt { background: var(--surface-alt); }
  .section h2 { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
  .muted { color: rgba(0,0,0,0.55); font-size: 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; margin-top: 28px; }
  .card { background: var(--surface); border: 1px solid rgba(0,0,0,0.07); border-radius: 16px; padding: 22px; }
  .card h3 { font-size: 16px; margin-bottom: 6px; }
  .card p { font-size: 14px; color: rgba(0,0,0,0.65); margin: 0; }
  .quote-section { padding: 64px 0; background: var(--surface-alt); }
  .quote-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start; }
  .quote-form { background: var(--surface); border-radius: 20px; padding: 28px; border: 1px solid rgba(0,0,0,0.07); box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
  .quote-form input, .quote-form select, .quote-form textarea { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.12); font-family: inherit; font-size: 14px; margin-bottom: 12px; background: #fff; color: var(--ink); }
  .quote-form label { font-size: 12.5px; font-weight: 600; color: rgba(0,0,0,0.6); display: block; margin-bottom: 5px; }
  .quote-form button { width: 100%; padding: 14px; }
  .quote-success { display: none; text-align: center; padding: 20px; }
  .quote-success.show { display: block; }
  .quote-success h3 { color: var(--accent); }
  .about-icon { width: 100%; aspect-ratio: 1; border-radius: 20px; display: flex; align-items: center; justify-content: center; background: var(--surface-alt); }
  .process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 24px; margin-top: 28px; }
  .process-num { width: 34px; height: 34px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; margin-bottom: 10px; }
  .process-step h4 { font-size: 15px; margin-bottom: 4px; }
  .process-step p { font-size: 13.5px; color: rgba(0,0,0,0.6); margin: 0; }
  .gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 24px; }
  .gallery-grid img { border-radius: 14px; aspect-ratio: 4/3; object-fit: cover; }
  .testimonial-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 24px; }
  .testimonial-card { background: var(--surface); border-radius: 16px; padding: 22px; border: 1px solid rgba(0,0,0,0.07); }
  .testimonial-card p { font-size: 14px; font-style: italic; }
  .founder-card { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
  .founder-avatar { width: 46px; height: 46px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; flex-shrink: 0; }
  .founder-card strong { display: block; font-size: 14.5px; }
  .founder-card .muted { font-size: 12.5px; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 20px; }
  .chip { background: var(--surface); border: 1px solid rgba(0,0,0,0.1); border-radius: 999px; padding: 7px 14px; font-size: 13px; font-weight: 600; }
  .faq { border-bottom: 1px solid rgba(0,0,0,0.08); padding: 14px 0; }
  .faq summary { cursor: pointer; font-weight: 700; font-size: 15px; }
  .faq p { margin-top: 10px; font-size: 14px; color: rgba(0,0,0,0.65); }
  .final-cta { background: var(--primary); color: #fff; text-align: center; padding: 60px 0; }
  .final-cta h2 { color: #fff; }
  .final-cta p { opacity: 0.85; }
  footer { padding: 32px 0 90px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; font-size: 12.5px; color: rgba(0,0,0,0.5); }
  .sticky-mobile { display: none; }
  @media (max-width: 760px) {
    .quote-layout { grid-template-columns: 1fr; }
    .sticky-mobile { display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 55; background: #fff; border-top: 1px solid rgba(0,0,0,0.1); box-shadow: 0 -6px 20px rgba(0,0,0,0.08); }
    .sticky-mobile a { flex: 1; text-align: center; padding: 14px 8px; font-weight: 700; font-size: 14px; }
    .sticky-mobile .call { background: var(--ink); color: #fff; }
    .sticky-mobile .quote { background: var(--accent); color: #fff; }
    footer { padding-bottom: 90px; }
    .header-phone { display: none; }
  }
</style>
</head>
<body>
<div class="demo-ribbon">DEMO PREVIEW</div>

${design.emergency_strip.enabled ? `<div class="emergency-strip">${esc(design.emergency_strip.text)}${phoneHref ? `<a href="${phoneHref}">Call now</a>` : ''}</div>` : ''}

<header>
  <div class="wrap">
    ${logoBlock}
    <div class="header-actions">
      ${phoneHref ? `<a href="${phoneHref}" class="header-phone">${esc(input.phone!)}</a>` : ''}
      <a href="#quote" class="btn btn-accent">${esc(design.cta_text)}</a>
    </div>
  </div>
</header>

<section class="hero">
  ${heroPhoto
    ? `<div class="hero-bg" style="background-image:url('${esc(heroPhoto)}')"></div><div class="hero-overlay" style="background:linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.6))"></div>`
    : `<div class="hero-overlay hero-noPhoto"></div>`}
  <div class="wrap hero-inner ${heroPhoto ? 'with-photo' : ''}">
    ${hasRealTrust ? `<div class="rating-badge"><span class="stars">${starRow(input.rating!)}</span> ${input.rating!.toFixed(1)} &middot; ${input.reviewCount} Google reviews</div>` : ''}
    <h1 class="headline">${esc(design.hero_headline)}</h1>
    <p class="subhead">${esc(design.hero_subhead)}</p>
    <div class="hero-ctas">
      <a href="#quote" class="btn btn-accent">${esc(design.cta_text)}</a>
      ${phoneHref ? `<a href="${phoneHref}" class="btn btn-outline" style="${heroPhoto ? 'border-color:rgba(255,255,255,0.4);color:#fff' : ''}">${esc(input.phone!)}</a>` : ''}
    </div>
  </div>
</section>

<div class="trust-bar"><div class="wrap">${trustBadgesHtml}</div></div>

<section id="quote" class="quote-section">
  <div class="wrap quote-layout">
    <div>
      <h2>Get a free, no-obligation quote</h2>
      <p class="muted">Tell us what you need and ${esc(input.businessName)} will get back to you.</p>
      ${founderHtml}
    </div>
    <div class="quote-form">
      <form id="lead-form">
        <input type="hidden" name="build_id" value="${esc(input.buildId)}" />
        <label>Name</label>
        <input type="text" name="name" required />
        <label>Phone</label>
        <input type="tel" name="phone" required />
        <label>Postcode</label>
        <input type="text" name="postcode" />
        <label>What do you need?</label>
        <select name="job_type">${jobTypeOptions}</select>
        <button type="submit" class="btn btn-accent">${esc(design.cta_text)}</button>
      </form>
      <div class="quote-success" id="lead-success">
        <h3>Thanks!</h3>
        <p>${esc(input.businessName)} will be in touch shortly.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div style="display:grid;grid-template-columns:1fr;gap:0">
      <h2>Why choose ${esc(input.businessName)}</h2>
      <div class="grid">${whyChooseHtml}</div>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <h2>What we do</h2>
    <div class="grid">${servicesHtml}</div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>About ${esc(input.businessName)}</h2>
    <p style="max-width:640px">${esc(design.about)}</p>
    <div class="process-grid">${processHtml}</div>
  </div>
</section>

${galleryHtml}
${testimonialsHtml}
${serviceAreasHtml}
${faqHtml}

<section class="final-cta">
  <div class="wrap">
    <h2>Ready to get started?</h2>
    <p>${phoneHref ? `Call now on ${esc(input.phone!)}` : 'Get in touch today'}</p>
    <a href="#quote" class="btn" style="background:#fff;color:var(--primary)">${esc(design.cta_text)}</a>
  </div>
</section>

<footer>
  <div class="wrap" style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;width:100%">
    <span>${esc(input.businessName)}${input.address ? ` &middot; ${esc(input.address)}` : ''}</span>
    <span>Website by August Marketing</span>
  </div>
</footer>

${phoneHref ? `<div class="sticky-mobile"><a href="${phoneHref}" class="call">Call ${esc(input.phone!)}</a><a href="#quote" class="quote">${esc(design.cta_text)}</a></div>` : ''}

<script>
(function () {
  var form = document.getElementById('lead-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = Object.fromEntries(new FormData(form).entries());
    var btn = form.querySelector('button');
    btn.disabled = true;
    fetch('https://augustosv3.vercel.app/api/website-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(function () {
      form.style.display = 'none';
      document.getElementById('lead-success').classList.add('show');
    }).catch(function () {
      btn.disabled = false;
      alert('Something went wrong, please call instead.');
    });
  });
})();
</script>

</body>
</html>`
}
