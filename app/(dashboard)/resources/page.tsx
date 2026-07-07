'use client';

import { useState, useCallback } from 'react';
import { ExternalLink, Download, ChevronDown, Sheet } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaymentLink {
  name: string;
  amount: string;
  subtitle: string;
  url: string;
  badge?: string;
}

interface Objection {
  question: string;
  answer: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const PAYMENT_LINKS: PaymentLink[] = [
  {
    name: 'Full Website',
    amount: '£1,995',
    subtitle: 'One-time, website + 3 months hosting',
    url: 'https://buy.stripe.com/PLACEHOLDER_FULL_1995',
    badge: 'Most Popular',
  },
  {
    name: 'Premium Website',
    amount: '£1,495',
    subtitle: 'One-time, full build',
    url: 'https://buy.stripe.com/5kQ3cw3cqagS38XglO4wM02',
  },
  {
    name: 'Standard Website',
    amount: '£1,195',
    subtitle: 'One-time, full build',
    url: 'https://buy.stripe.com/4gMeVe4gugFg7pd2uY4wM03',
  },
  {
    name: 'Website + £500 Deposit',
    amount: '£500',
    subtitle: 'Deposit to secure, balance on delivery',
    url: 'https://buy.stripe.com/PLACEHOLDER_DEPOSIT_500',
  },
  {
    name: 'Website',
    amount: '£950',
    subtitle: 'Starter site, pay in full',
    url: 'https://buy.stripe.com/PLACEHOLDER_950',
  },
  {
    name: 'Monthly Hosting',
    amount: '£75/mo',
    subtitle: 'After 3-month free period',
    url: 'https://buy.stripe.com/PLACEHOLDER_MONTHLY',
  },
];

const OBJECTIONS: Objection[] = [
  {
    question: 'We already have a website',
    answer:
      'Brilliant — do you know how many leads it\'s generating per month? Most sites we look at aren\'t set up to convert. We specialise in roofing specifically, so we know exactly what local customers search for and how to turn those visits into calls.',
  },
  {
    question: 'Not interested / too busy',
    answer:
      'Totally get that — I\'ll be quick. We build roofing sites that rank locally and bring calls in. Took one of our clients from zero online presence to 8 inbound leads in the first month. If even one extra job comes from it, it pays for itself. Worth 5 minutes?',
  },
  {
    question: 'How much does it cost?',
    answer:
      'We have options from £950 all the way to £1,995 — and we offer a £500 deposit to get started. The site pays for itself with one extra job, and most of our clients see that within the first 30 days. We also include 3 months of free hosting so there\'s no ongoing cost to worry about upfront.',
  },
];

// ─── CopyCard (client component) ─────────────────────────────────────────────

function CopyCard({ link }: { link: PaymentLink }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea');
      el.value = link.url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [link.url]);

  return (
    <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-lg font-bold text-[#e4e6f0] tabular-nums leading-tight">
            {link.amount}
          </span>
          <span className="text-sm font-medium text-[#e4e6f0]">{link.name}</span>
          <span className="text-xs text-[#636780] mt-0.5">{link.subtitle}</span>
        </div>
        {link.badge && (
          <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
            {link.badge}
          </span>
        )}
      </div>

      <p className="text-xs text-[#636780] truncate font-mono">{link.url}</p>

      <button
        onClick={handleCopy}
        className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          copied
            ? 'bg-green-500/10 text-green-400'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
        }`}
      >
        {copied ? '✓ Copied!' : 'Copy Link'}
      </button>
    </div>
  );
}

// ─── CopyUrlButton (client component) ────────────────────────────────────────

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [url]);

  return (
    <button
      onClick={handleCopy}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        copied
          ? 'bg-green-500/10 text-green-400'
          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
      }`}
    >
      {copied ? '✓ Copied!' : 'Copy URL'}
    </button>
  );
}

// ─── ResourceTabs (client component) ─────────────────────────────────────────

function ResourceTabs() {
  const [activeTab, setActiveTab] = useState<'script' | 'objections' | 'after'>('script');
  const [openObjection, setOpenObjection] = useState<number | null>(null);

  return (
    <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#e4e6f0]">
          Cold Call Script &amp; Objections
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#08090c] rounded-lg p-1 w-fit border border-[#1c2035]">
        {([
          { key: 'script', label: 'Script' },
          { key: 'objections', label: 'Objections' },
          { key: 'after', label: 'After the Call' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-indigo-600 text-white'
                : 'text-[#636780] hover:text-[#e4e6f0] hover:bg-[#181b27]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Script tab */}
      {activeTab === 'script' && (
        <div className="flex flex-col gap-5">
          {/* Opening line */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#636780] mb-3">
              Opening Line
            </p>
            <blockquote className="border-l-2 border-indigo-500 pl-4 bg-[#181b27] rounded-r-lg py-3 pr-4">
              <p className="text-sm text-[#e4e6f0] leading-relaxed italic">
                &ldquo;Hi, is that [Name]? It&apos;s [Your Name] from August Marketing — I won&apos;t
                take up too much of your time. I was looking at your website and I had a few ideas
                that could help bring in more roofing leads. Would you be open to a quick
                10-minute call to run you through them?&rdquo;
              </p>
            </blockquote>
          </div>

          {/* Key points */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#636780] mb-3">
              Key Points to Hit
            </p>
            <ul className="flex flex-col gap-2">
              {[
                'Mention you built 50+ roofing sites (social proof)',
                'The website pays for itself with 1-2 extra jobs',
                'Quick turnaround — 5 working days',
              ].map((point, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[#e4e6f0]">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-semibold shrink-0 tabular-nums">
                    {i + 1}
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Objections tab */}
      {activeTab === 'objections' && (
        <div className="flex flex-col gap-2">
          {OBJECTIONS.map((obj, i) => (
            <div
              key={i}
              className="border border-[#1c2035] rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenObjection(openObjection === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left bg-[#181b27] hover:bg-[#1c2035] transition-colors"
              >
                <span className="text-sm font-medium text-[#e4e6f0]">
                  &ldquo;{obj.question}&rdquo;
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-[#636780] shrink-0 transition-transform ${
                    openObjection === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openObjection === i && (
                <div className="px-4 py-3 bg-[#10121a] border-t border-[#1c2035]">
                  <p className="text-sm text-[#e4e6f0] leading-relaxed">{obj.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* After the Call tab */}
      {activeTab === 'after' && (
        <div className="flex flex-col gap-6">

          {/* Step 1: Payment confirmed */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#636780] mb-3">Step 1 — Payment on the Call</p>
            <div className="bg-[#181b27] rounded-lg border border-[#1c2035] p-4">
              <p className="text-sm text-[#e4e6f0] leading-relaxed">
                Once they say yes, send the Stripe payment link straight away — don&apos;t let the call end without payment confirmed.
                Use the links in the <span className="text-indigo-400">Stripe Payment Links</span> section above.
              </p>
            </div>
          </div>

          {/* Step 2: Group chat */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#636780] mb-3">Step 2 — Create the Group Chat</p>
            <div className="flex flex-col gap-2">
              {[
                'Create a WhatsApp group with the client and add the CEO immediately.',
                'Introduce everyone: "Hi [Name], welcome to August — this is your direct line to us. Any questions, any time."',
                'Make clear they have 24/7 access — this sets the tone and builds trust straight away.',
              ].map((point, i) => (
                <div key={i} className="flex items-start gap-3 bg-[#181b27] rounded-lg border border-[#1c2035] px-4 py-3">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-semibold shrink-0 tabular-nums">{i + 1}</span>
                  <p className="text-sm text-[#e4e6f0] leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Domain */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#636780] mb-3">Step 3 — Domain</p>
            <div className="flex flex-col gap-3">
              <blockquote className="border-l-2 border-amber-500 pl-4 bg-[#181b27] rounded-r-lg py-3 pr-4">
                <p className="text-sm text-[#e4e6f0] leading-relaxed italic">
                  &ldquo;Do you already have a domain name for the website — something like yourbusiness.co.uk?&rdquo;
                </p>
              </blockquote>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#181b27] border border-green-500/20 rounded-lg p-4">
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">They have a domain</p>
                  <p className="text-sm text-[#e4e6f0] leading-relaxed">
                    Ask them to either share login details in the group chat, or add August as a domain manager.
                    We&apos;ll handle the DNS pointing.
                  </p>
                </div>
                <div className="bg-[#181b27] border border-amber-500/20 rounded-lg p-4">
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">They need a domain</p>
                  <p className="text-sm text-[#e4e6f0] leading-relaxed">
                    Suggest names on the call. Think: <span className="font-mono text-[#e4e6f0]">[company]-roofing.co.uk</span>, <span className="font-mono text-[#e4e6f0]">[area]roofing.co.uk</span>.
                    Check availability live on GoDaddy — share your screen or paste options in the group chat.
                    We purchase it and bill it back, or they buy it directly.
                  </p>
                </div>
              </div>

              <a
                href="https://www.godaddy.com/en-uk/domainsearch/find"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 self-start bg-[#181b27] hover:bg-[#1e2133] border border-[#1c2035] rounded-lg px-4 py-2 text-sm text-[#e4e6f0] font-medium transition-colors"
              >
                Check domain availability on GoDaddy
                <ExternalLink className="h-3.5 w-3.5 text-[#636780]" />
              </a>
            </div>
          </div>

          {/* Step 4: 72 hours */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#636780] mb-3">Step 4 — Set Expectations</p>
            <blockquote className="border-l-2 border-indigo-500 pl-4 bg-[#181b27] rounded-r-lg py-3 pr-4">
              <p className="text-sm text-[#e4e6f0] leading-relaxed italic">
                &ldquo;We aim to have your website live within 72 hours — fully built, on your domain, ready to take calls.
                We&apos;ll keep you updated in the group chat every step of the way.&rdquo;
              </p>
            </blockquote>
            <div className="mt-3 flex flex-col gap-2">
              {[
                'Ask for any photos they want on the site (team shots, past jobs, vans, etc.)',
                'Confirm their phone number and email to display on the site',
                'Double-check their service areas and any specialisms (flat roofs, guttering, etc.)',
              ].map((point, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-[#e4e6f0]">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-semibold shrink-0">✓</span>
                  {point}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-8 font-[Inter,system-ui,sans-serif]">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-[#e4e6f0]">Resources</h1>
          <p className="text-sm text-[#636780]">
            Everything you need during a call — one place.
          </p>
        </div>

        {/* Section: Stripe Payment Links */}
        <section className="flex flex-col gap-4">
          <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-base font-semibold text-[#e4e6f0]">Stripe Payment Links</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PAYMENT_LINKS.map((link, i) => (
                <CopyCard key={i} link={link} />
              ))}
            </div>
          </div>
        </section>

        {/* Section: Leads Tracker */}
        <section>
          <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <Sheet className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#e4e6f0]">Leads Tracker</h2>
                <p className="text-xs text-[#636780] mt-0.5">Google Sheet — all active and historic leads</p>
              </div>
            </div>
            <a
              href="https://docs.google.com/spreadsheets/d/1dtgkkIER73S71hrzSZDvBmNnlPUoCSCf5hIbu2bvfOo/edit"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#181b27] hover:bg-[#1e2133] border border-[#1c2035] rounded-lg px-3 py-1.5 text-sm text-[#e4e6f0] font-medium transition-colors whitespace-nowrap"
            >
              Open Sheet <ExternalLink className="h-3.5 w-3.5 text-[#636780]" />
            </a>
          </div>
        </section>

        {/* Section: Cold Call Script & Objections */}
        <section>
          <ResourceTabs />
        </section>

        {/* Section: GHL / Setup Notes */}
        <section>
          <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-base font-semibold text-[#e4e6f0]">
              GoHighLevel &amp; Lead Tracking
            </h2>
            <p className="text-sm text-[#636780] leading-relaxed">
              GHL SOP coming soon. In the meantime, log all outcomes in the Call Tracker tab.
            </p>
            <div>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
              >
                Open GHL
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </section>

        {/* Section: Caller SOP */}
        <section>
          <div className="bg-[#10121a] border border-[#1c2035] rounded-xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Download className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#e4e6f0]">Caller SOP</h2>
                <p className="text-xs text-[#636780] mt-0.5">Script, objections, and what to do after the call</p>
              </div>
            </div>
            <a
              href="/sop"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
            >
              Open SOP <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </section>

      </div>
    </div>
  );
}
