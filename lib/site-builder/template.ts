// Renders a single self-contained HTML file for the demo site. No build step,
// Tailwind via the Play CDN, so it deploys to Vercel in seconds. Niche-aware
// copy tags and imagery keep it from looking cloned across niches even though
// it's one template.

import type { SiteDesign } from './design'

export type TemplateInput = {
  businessName: string
  niche: string
  city: string | null
  serviceArea: string | null
  phone: string | null
  logoUrl: string | null
  design: SiteDesign
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const NICHE_BADGE: Record<SiteDesign['niche_category'], string> = {
  trades: 'Fully Insured · Local & Trusted',
  hospitality: 'Booking Available · Locally Loved',
  professional: 'Trusted Advisors · Free Consultation',
  beauty_wellness: 'Book Online · 5-Star Care',
  retail: 'In Store & Online · Local Favourite',
  generic: 'Trusted Locally',
}

const NICHE_HERO_TONE: Record<SiteDesign['niche_category'], string> = {
  trades: 'font-extrabold tracking-tight',
  hospitality: 'font-serif italic',
  professional: 'font-semibold tracking-tight',
  beauty_wellness: 'font-light tracking-wide',
  retail: 'font-bold',
  generic: 'font-bold',
}

// No third-party photo API (Unsplash Source is dead, others need keys) — a
// niche icon on a gradient-mesh panel reads clean and premium and can never
// 404 on the call.
const NICHE_ICON: Record<SiteDesign['niche_category'], string> = {
  trades: '<path d="M3 12L12 4l9 8"/><path d="M6 10.5V20h12v-9.5"/><path d="M10 20v-5h4v5"/>',
  hospitality: '<path d="M4 3v18"/><path d="M4 3c0 3 3 3 3 6s-3 3-3 6"/><path d="M17 3v18"/><path d="M14 9h6"/><circle cx="17" cy="6" r="3"/>',
  professional: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
  beauty_wellness: '<path d="M12 2c2 3 4 5 4 8a4 4 0 0 1-8 0c0-3 2-5 4-8Z"/><path d="M12 14v8"/><path d="M8 22h8"/>',
  retail: '<path d="M6 2 3 7v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-3-5Z"/><path d="M3 7h18"/><path d="M9 11a3 3 0 0 0 6 0"/>',
  generic: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
}

export function renderSiteHtml(input: TemplateInput): string {
  const { design } = input
  const { primary, secondary, accent, dark, light } = design.palette
  const nicheIcon = NICHE_ICON[design.niche_category] || NICHE_ICON.generic
  const phoneHref = input.phone ? `tel:${input.phone.replace(/[^\d+]/g, '')}` : '#contact'
  const badge = NICHE_BADGE[design.niche_category] || NICHE_BADGE.generic
  const heroTone = NICHE_HERO_TONE[design.niche_category] || NICHE_HERO_TONE.generic
  const areaLine = input.serviceArea || input.city || ''

  const servicesHtml = design.services.map(s => `
    <div class="rounded-2xl p-6 bg-white/5 border border-white/10 hover:border-[var(--accent)]/50 transition-colors">
      <h3 class="text-lg font-semibold mb-2" style="color: var(--light)">${esc(s.name)}</h3>
      <p class="text-sm opacity-70">${esc(s.description)}</p>
    </div>`).join('')

  const trustHtml = design.trust_points.map(t => `
    <div class="flex items-center gap-2 text-sm opacity-90">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
      <span>${esc(t)}</span>
    </div>`).join('')

  const logoBlock = input.logoUrl
    ? `<img src="${esc(input.logoUrl)}" alt="${esc(input.businessName)}" class="h-9 w-auto object-contain" />`
    : `<span class="text-lg font-bold tracking-tight" style="color: var(--light)">${esc(input.businessName)}</span>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(design.hero_headline)} | ${esc(input.businessName)}</title>
<meta name="description" content="${esc(design.hero_subhead)}" />
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;1,600&display=swap" rel="stylesheet">
<style>
  :root { --primary: ${primary}; --secondary: ${secondary}; --accent: ${accent}; --dark: ${dark}; --light: ${light}; }
  body { font-family: 'Inter', sans-serif; background: var(--dark); color: var(--light); }
  .font-serif { font-family: 'Playfair Display', serif; }
  .demo-ribbon { position: fixed; top: 14px; right: -42px; transform: rotate(45deg); background: var(--accent); color: var(--dark); font-size: 11px; font-weight: 700; padding: 4px 50px; z-index: 50; letter-spacing: 0.04em; }
  .mesh-bg {
    background:
      radial-gradient(circle at 15% 20%, var(--primary) 0%, transparent 45%),
      radial-gradient(circle at 85% 15%, var(--secondary) 0%, transparent 40%),
      radial-gradient(circle at 50% 90%, var(--accent) 0%, transparent 35%),
      var(--dark);
  }
  .mesh-blob { filter: blur(60px); opacity: 0.35; }
</style>
</head>
<body class="antialiased">
<div class="demo-ribbon">DEMO PREVIEW</div>

<header class="sticky top-0 z-40 backdrop-blur-md bg-black/30 border-b border-white/10">
  <div class="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
    ${logoBlock}
    <a href="${phoneHref}" class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style="background: var(--accent); color: var(--dark)">
      ${input.phone ? `Call ${esc(input.phone)}` : 'Get in touch'}
    </a>
  </div>
</header>

<section class="relative overflow-hidden mesh-bg">
  <div class="absolute -top-24 -left-24 w-72 h-72 rounded-full mesh-blob" style="background: var(--primary)"></div>
  <div class="absolute -top-16 -right-16 w-80 h-80 rounded-full mesh-blob" style="background: var(--secondary)"></div>
  <div class="absolute inset-0" style="background: linear-gradient(180deg, transparent 0%, var(--dark) 90%)"></div>
  <div class="relative max-w-6xl mx-auto px-5 pt-20 pb-24 text-center">
    <span class="inline-block text-xs font-semibold tracking-widest uppercase mb-4 px-3 py-1 rounded-full" style="background: var(--accent)1a; color: var(--accent); border: 1px solid var(--accent)">${esc(badge)}</span>
    <h1 class="${heroTone} text-4xl sm:text-6xl leading-tight mb-5" style="color: var(--light)">${esc(design.hero_headline)}</h1>
    <p class="text-base sm:text-lg opacity-75 max-w-2xl mx-auto mb-8">${esc(design.hero_subhead)}</p>
    <div class="flex items-center justify-center gap-3 flex-wrap">
      <a href="#contact" class="rounded-full px-6 py-3 text-sm font-semibold" style="background: var(--accent); color: var(--dark)">${esc(design.cta_text)}</a>
      <a href="${phoneHref}" class="rounded-full px-6 py-3 text-sm font-semibold border border-white/25 hover:bg-white/10">${input.phone ? esc(input.phone) : 'Contact us'}</a>
    </div>
  </div>
</section>

<section class="border-y border-white/10 bg-white/5">
  <div class="max-w-6xl mx-auto px-5 py-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
    ${trustHtml}
  </div>
</section>

<section class="max-w-6xl mx-auto px-5 py-16">
  <h2 class="text-2xl sm:text-3xl font-bold mb-2" style="color: var(--light)">What we do</h2>
  ${areaLine ? `<p class="text-sm opacity-60 mb-8">Serving ${esc(areaLine)}</p>` : '<div class="mb-8"></div>'}
  <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
    ${servicesHtml}
  </div>
</section>

<section class="max-w-6xl mx-auto px-5 py-16 grid md:grid-cols-2 gap-10 items-center">
  <div>
    <h2 class="text-2xl sm:text-3xl font-bold mb-4" style="color: var(--light)">About ${esc(input.businessName)}</h2>
    <p class="text-sm sm:text-base opacity-75 leading-relaxed">${esc(design.about)}</p>
  </div>
  <div class="relative rounded-2xl overflow-hidden aspect-square mesh-bg flex items-center justify-center">
    <div class="absolute -bottom-10 -right-10 w-56 h-56 rounded-full mesh-blob" style="background: var(--accent)"></div>
    <svg class="relative" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="var(--light)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85">${nicheIcon}</svg>
  </div>
</section>

<section id="contact" class="relative overflow-hidden">
  <div class="absolute inset-0" style="background: linear-gradient(120deg, var(--primary), var(--secondary))"></div>
  <div class="relative max-w-3xl mx-auto px-5 py-16 text-center">
    <h2 class="text-2xl sm:text-3xl font-bold mb-3 text-white">Ready to get started?</h2>
    <p class="text-sm sm:text-base text-white/85 mb-7">${input.phone ? `Call now on ${esc(input.phone)}` : 'Get in touch today'}${areaLine ? ` &middot; serving ${esc(areaLine)}` : ''}</p>
    <a href="${phoneHref}" class="inline-block rounded-full px-7 py-3 text-sm font-semibold bg-white" style="color: var(--dark)">${esc(design.cta_text)}</a>
  </div>
</section>

<footer class="max-w-6xl mx-auto px-5 py-8 flex flex-wrap items-center justify-between gap-3 text-xs opacity-50">
  <span>${esc(input.businessName)}${input.city ? ` &middot; ${esc(input.city)}` : ''}</span>
  <span>Website by August Marketing</span>
</footer>

</body>
</html>`
}
