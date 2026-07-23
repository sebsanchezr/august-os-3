'use client'

import Link from 'next/link'

// ─── Shared building blocks (match the styling of the other SOP pages) ───────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-[0.13em] uppercase text-[#636780] print:text-gray-500 mb-5">
      {children}
    </h2>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-[#e4e6f0] print:text-black mb-3">{children}</h3>
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((point, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className="mt-0.5 h-5 w-5 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-semibold shrink-0">{i + 1}</span>
          <p className="text-sm text-[#e4e6f0] print:text-gray-800">{point}</p>
        </div>
      ))}
    </div>
  )
}

function CheckList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((point, i) => (
        <div key={i} className="flex items-start gap-2 text-sm text-[#e4e6f0] print:text-gray-800">
          <span className="text-indigo-400 mt-0.5 shrink-0">&#10003;</span>
          <p>{point}</p>
        </div>
      ))}
    </div>
  )
}

function Callout({ tone = 'indigo', children }: { tone?: 'indigo' | 'amber'; children: React.ReactNode }) {
  const border = tone === 'amber' ? 'border-amber-500' : 'border-indigo-500'
  return (
    <div className={`border-l-2 ${border} pl-4 bg-[#10121a] print:bg-gray-50 rounded-r-lg py-3 pr-4`}>
      <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed">{children}</p>
    </div>
  )
}

function Flow({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#e4e6f0] print:text-gray-800 bg-[#181b27] print:bg-gray-100 border border-[#1c2035] print:border-gray-200 rounded-md px-2.5 py-1">
            {step}
          </span>
          {i < steps.length - 1 && <span className="text-[#636780] text-xs">&rarr;</span>}
        </span>
      ))}
    </div>
  )
}

function Divider() {
  return <div className="border-t border-[#1c2035] print:border-gray-200 mb-10" />
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OsGuideSopPage() {
  return (
    <div className="min-h-screen bg-[#08090c] px-6 py-10 print:bg-white print:text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <Link href="/sop" className="text-xs text-[#636780] hover:text-indigo-400 print:hidden">&larr; Back to SOPs</Link>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#636780] print:text-gray-500 mb-2 mt-3">August Marketing</p>
          <h1 className="text-3xl font-bold text-[#e4e6f0] print:text-black tracking-tight">August OS Team Guide</h1>
          <p className="text-sm text-[#636780] print:text-gray-500 mt-1">The daily operating manual. Every piece of client work runs through the OS.</p>
          <div className="mt-4 border-t border-[#1c2035] print:border-gray-200" />
        </div>

        {/* Section 1: Morning routine */}
        <section className="mb-10">
          <SectionHeading>1. Morning Routine (per role)</SectionHeading>
          <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed mb-6">
            Everyone starts the day in the OS, not in WhatsApp or email. Order matters.
          </p>

          <div className="mb-6">
            <SubHeading>Everyone, first 5 minutes</SubHeading>
            <NumberedList items={[
              'Open /updates. The daily digest rolls up yesterday: EOD call numbers, cold email replies, tasks completed and created, meetings held yesterday and scheduled today.',
              'Open /tasks and filter to yourself. Anything assigned to you or where you are a collaborator is your day.',
            ]} />
          </div>

          <div className="mb-6">
            <SubHeading>Account managers / fulfilment</SubHeading>
            <NumberedList items={[
              '/fulfilment is your home page: Your Tasks, overdue counts, meetings this week, onboardings in flight, clients at risk.',
              'Check /accounts/issues for open issues on your clients.',
            ]} />
          </div>

          <div className="mb-6">
            <SubHeading>Media buyers (Ambar, Taij, Juan)</SubHeading>
            <NumberedList items={[
              '/tasks, Creative Pipeline tab: check the Sent to Media Buyer column. Those creatives are approved and waiting on you to put them live.',
              '/ads, cycle through each of your clients. Read the KPIs and hygiene findings (section 5).',
              '/meetings for any client calls today. Prep packs appear in the meeting slide-over.',
            ]} />
          </div>

          <div className="mb-6">
            <SubHeading>Ad editors (Alvin)</SubHeading>
            <NumberedList items={[
              '/tasks, Creative Pipeline tab. Your columns are Brief, Editing, and Revision. Revision items come first, a client is waiting on them.',
              '/creatives for strategies marked Delivered with fresh image grids, and Quick Generate output waiting to become finished ads.',
            ]} />
          </div>

          <div>
            <SubHeading>Seb</SubHeading>
            <NumberedList items={[
              '/accounts/approvals. Nothing goes to a client until it is approved here. Clear the queue every morning.',
              '/accounts/issues. Any trust-threatening or financial issue is founder-handled, same day, personally.',
              '/pipeline and /sales for the acquisition side.',
            ]} />
          </div>
        </section>

        <Divider />

        {/* Section 2: Task workflow */}
        <section className="mb-10">
          <SectionHeading>2. Task Workflow</SectionHeading>
          <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed mb-5">
            The board at /tasks has two tracks, switched by tabs at the top.
          </p>

          <div className="mb-5">
            <SubHeading>Creative Pipeline (client ad creatives)</SubHeading>
            <Flow steps={['Brief', 'Editing', 'Revision', 'Approved by Client', 'Sent to Media Buyer', 'Live']} />
          </div>

          <div className="mb-6">
            <SubHeading>Ops (everything else)</SubHeading>
            <Flow steps={['Brief', 'In Progress', 'Review', 'Completed']} />
          </div>

          <div className="mb-6">
            <SubHeading>How tasks move</SubHeading>
            <CheckList items={[
              'Drag and drop on the board, click the status pills in the task detail panel, or use the inline dropdown on /tasks/list.',
              'Editors own Brief through Revision. The account manager or Seb moves a card to Approved by Client once the client signs off, then to Sent to Media Buyer. The media buyer owns the final move to Live.',
              'On the Ops track, the assignee moves their own card.',
              'Reaching Live or Completed marks the task done. Completed tasks drop off the board and can be restored at /tasks/archive.',
              'Creating tasks: press N on the board or click New task. Title is the only required field, but always set assignee, client, priority, and due date.',
            ]} />
          </div>

          <div className="mb-6">
            <SubHeading>The Sent to Media Buyer handoff</SubHeading>
            <Callout>
              Moving a creative task into Sent to Media Buyer fires a Discord notification tagging the assignee: creative ready to go live.
              The media buyer uploads it to the ad account and moves the card to Live. There is no auto-reassignment, so make sure the
              task is assigned to the right buyer before you move it.
            </Callout>
          </div>

          <div>
            <SubHeading>Comments and Discord</SubHeading>
            <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
              Comments live in the task detail panel. Commenting on someone else&apos;s task pings the task owner on Discord.
              Assigning a task pings the new assignee. Keep all task context in comments so the history stays on the card, not in DMs.
            </p>
          </div>
        </section>

        <Divider />

        {/* Section 3: Client management */}
        <section className="mb-10">
          <SectionHeading>3. Client Management Daily Cadence</SectionHeading>

          <div className="mb-6">
            <SubHeading>Log every client touch</SubHeading>
            <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed mb-3">
              Open the client&apos;s HQ (/accounts, click the client) and use the Log comm quick action on the Overview tab.
              Record direction, channel (WhatsApp, email, call, meeting), sentiment, and a one-line summary. The SLA inbox,
              health dots, and weekly reports all read from this log.
            </p>
            <CheckList items={[
              'Logging an inbound comm starts a response clock: WhatsApp 2h, email 24h.',
              'Logging an outbound comm clears the oldest open clock for that client automatically.',
              'Warning trigger words in a summary fire an early-warning Discord alert. That is intended, do not soften the summary to avoid it.',
              'Client HQ tabs: Overview, Assets, Weekly Report, Past Meetings, History, Settings (targets, ROAS goal, Meta ad account ID, reporting cadence).',
            ]} />
          </div>

          <div className="mb-6">
            <SubHeading>Weekly reports approval flow</SubHeading>
            <Flow steps={['Mac reporter drafts', 'Pending approval', 'Seb approves', 'Posted to Discord', 'AM sends to client WhatsApp']} />
            <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed mt-3">
              Friday EOW reports and Monday kickoff messages are drafted automatically and land in /accounts/approvals with an
              internal brief and an editable client message. Approval posts the final copy-paste-ready text to Discord.
              Rejecting captures a note for the redraft. Nothing reaches a client without passing this queue.
            </p>
          </div>

          <div className="mb-6">
            <SubHeading>Issues board rules</SubHeading>
            <Flow steps={['Open', 'Resolving', 'Resolved']} />
            <div className="mt-3">
              <CheckList items={[
                'Raise issues from the client HQ with category, severity, and owner.',
                'Major and trust-threatening severities, and anything financial, alert Discord immediately and are founder-handled the same day.',
                'An issue cannot be resolved without a root cause and a process fix. Fix the system, not just the instance.',
              ]} />
            </div>
          </div>

          <div>
            <SubHeading>Meetings</SubHeading>
            <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
              Prep packs are drafted automatically about a day before each call and land in the approvals queue. After the call,
              the transcript is picked up automatically, minutes are drafted, and action items are inserted as tasks. Review the
              draft minutes in the meeting slide-over, then Send to client. Add talking points during the week via the client HQ
              quick action, they get woven into the next report.
            </p>
          </div>
        </section>

        <Divider />

        {/* Section 4: Ad creative workflow */}
        <section className="mb-10">
          <SectionHeading>4. Ad Creative Workflow</SectionHeading>
          <p className="text-sm text-[#e4e6f0] print:text-gray-800 leading-relaxed mb-5">
            All creative generation lives at /creatives (Creative Hub).
          </p>

          <div className="mb-6">
            <SubHeading>Weekly strategy cycle (one card per client per week)</SubHeading>
            <Flow steps={['Draft', 'Approved', 'Generate statics', 'Delivered']} />
            <div className="mt-3">
              <NumberedList items={[
                'Draft: create via New Strategy, pick the client and the focus. The OS drafts a strategy with three static ad concepts from the last 14 days of metrics and the knowledge base.',
                'Approved: a human reads the strategy and clicks Approve. Nothing generates until a person approves.',
                'Generate statics: click the button on an approved card. The OS renders the three concepts as static images in about a minute.',
                'Delivered: images appear as a grid on the card, each with Open and Copy URL. Not happy? Click Regenerate to re-run the set.',
              ]} />
            </div>
          </div>

          <div className="mb-6">
            <SubHeading>Quick Generate (ad hoc, no strategy needed)</SubHeading>
            <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
              The form at the top of /creatives. Pick the client, set quantity (1 to 4), and write a plain-language brief,
              for example: bold product-on-colour ad for the summer sale, price 29.99, urgent tone. Statics generate in under
              a minute and appear right below the form. Use it for urgent requests, quick tests, and mid-week client asks.
            </p>
          </div>

          <div>
            <SubHeading>Where images land</SubHeading>
            <Callout>
              Every generated image is stored with a permanent public URL and surfaced in the grids on /creatives. Editors open
              or copy the URL straight from the grid, finish the ad if needed, and attach it to the creative task. Nothing is
              pushed to Meta automatically. A human always sits between generation and live spend.
            </Callout>
          </div>
        </section>

        <Divider />

        {/* Section 5: Media buyer workflow */}
        <section className="mb-10">
          <SectionHeading>5. Media Buyer Workflow</SectionHeading>

          <div className="mb-6">
            <SubHeading>Daily, per client, at /ads</SubHeading>
            <NumberedList items={[
              'Pick the client from the dropdown. Read the four KPI cards (7-day spend, revenue, ROAS, CPA), the 14-day spend/ROAS chart, and the daily breakdown table. Metrics sync from Meta automatically every morning.',
              'Press Generate Recommendations. Hygiene checks run against the live account, then an AI operational review turns the findings into a prioritised checklist, highest severity first.',
              'Work the checklist top to bottom. Verify each flag inside Ads Manager yourself, then act, or consciously decide not to.',
            ]} />
          </div>

          <div className="mb-6">
            <SubHeading>What the hygiene checks catch</SubHeading>
            <CheckList items={[
              'Active ad sets spending with zero purchases',
              'Paused winners beating target ROAS',
              'Active ads running far below target while the account hits target',
              'Frequency fatigue (7-day frequency over 4)',
              'Active entities with no delivery at all',
              'Spend up sharply while ROAS falls week over week',
              'Duplicate ad set names and budget outliers',
            ]} />
          </div>

          <div>
            <SubHeading>What the tool does NOT do</SubHeading>
            <Callout tone="amber">
              It never touches your account. It cannot pause, launch, edit budgets, or change anything on Meta, it is read-only
              by design. It also does not do strategy: no new audiences, no new campaign structures, no scaling plans. It only
              catches operational things you may have missed. Buyers stay in control of every decision.
            </Callout>
          </div>
        </section>

        <Divider />

        {/* Section 6: Onboarding */}
        <section className="mb-10">
          <SectionHeading>6. Onboarding a New Client</SectionHeading>

          <div className="mb-6">
            <SubHeading>Full onboarding pipeline (default for every closed-won deal)</SubHeading>
            <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed mb-3">
              On /pipeline, mark the deal Won, then click Start Onboarding. That creates the onboarding record, sends the
              contract, and raises the first invoice automatically. The card then walks the /onboarding board:
            </p>
            <Flow steps={['Won', 'Contract Sent', 'Signed', 'Form Completed', 'Kickoff Booked', 'Kickoff Held', 'Building', 'Launched', 'Handed Off']} />
            <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed mt-3">
              Signing unlocks the client welcome portal and creates the client record. Payment gates launch: a client cannot
              be flipped to Launched until the first invoice is paid. Each milestone posts to Discord.
            </p>
          </div>

          <div>
            <SubHeading>New client button on /accounts (the shortcut)</SubHeading>
            <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
              Creates a bare client record with name, contact, and services. No contract, no invoice, no portal. Use it only
              for clients that predate the OS or genuinely skip onboarding. After creation, fill in the client&apos;s Settings tab
              (ROAS target, budget, Meta ad account ID, reporting cadence) or the ads and reporting features will have nothing
              to work with.
            </p>
          </div>
        </section>

        <Divider />

        {/* Section 7: EOD */}
        <section className="mb-10">
          <SectionHeading>7. EOD Reports</SectionHeading>
          <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
            Cold callers submit an EOD report at /eod every working day, no exceptions. Click Submit EOD and fill in: your name,
            calls made, positive replies, calls booked, and notes. The page shows your positive rate and booking rate live, and
            the numbers feed the next morning&apos;s digest on /updates. An unsubmitted EOD means your day&apos;s work is invisible
            to the team.
          </p>
        </section>

        <Divider />

        {/* Section 8: Automated vs manual */}
        <section className="mb-10">
          <SectionHeading>8. What Is Automated vs Manual</SectionHeading>

          <div className="mb-6">
            <SubHeading>Automated: Vercel crons (all times UTC)</SubHeading>
            <CheckList items={[
              '05:45 meta-sync: pulls the last 3 days of Meta metrics for every connected client',
              '06:00 calendar-sync: syncs meetings from Google Calendar',
              '06:30 instantly-sync: cold email stats',
              '07:00 daily-digest: writes the daily roll-up to /updates',
              '08:00 invoice-reminders: flags invoices due',
              '09:00 report-approvals: pings Discord about reports waiting in the approvals queue',
              '09:00 Mon-Fri upwork-search: pulls new Upwork opportunities',
              '10:00 metrics-staleness: warns on Discord if client metrics stop syncing',
            ]} />
          </div>

          <div className="mb-6">
            <SubHeading>Automated: Mac reporter (drafts only, never sends)</SubHeading>
            <CheckList items={[
              'Daily metrics sync with top creatives and competitor notes',
              'Friday EOW client reports and Monday kickoff messages, drafted into the approvals queue',
              'Meeting prep packs about 24h before each call',
              'Post-meeting minutes and action-item tasks from transcripts, checked every 15 minutes',
            ]} />
          </div>

          <div className="mb-6">
            <SubHeading>Automated: Discord notifications</SubHeading>
            <p className="text-sm text-[#636780] print:text-gray-600 leading-relaxed">
              Task assignments, comments, media buyer handoffs, reports ready for approval, approved client comms, issue alerts,
              SLA warnings and breaches, meeting reminders, onboarding milestones, deal won and lost, creatives generated.
            </p>
          </div>

          <div>
            <SubHeading>Always manual (by design)</SubHeading>
            <Callout>
              Approving anything client-facing, sending WhatsApp messages, moving task cards, approving creative strategies,
              every change inside Meta Ads Manager, and marking issues resolved. The system drafts and flags. Humans decide and send.
            </Callout>
          </div>
        </section>

        <Divider />

        {/* Section 9: Troubleshooting */}
        <section className="mb-10">
          <SectionHeading>9. Troubleshooting</SectionHeading>
          <div className="mb-5">
            <Callout tone="amber">
              Empty or stale data almost always means an environment variable or a dead token, not a bug. Check ENV_CHECKLIST.md
              in the repo root first, it maps every env var to exactly what breaks without it.
            </Callout>
          </div>
          <CheckList items={[
            '/ads shows no data or metrics stop updating: the Meta access token is dead or missing. The sync silently skips when the token is gone; the 10:00 staleness cron should have warned on Discord.',
            'A client shows (Not connected) in the /ads dropdown: no Meta ad account ID on the client Settings tab.',
            'Generate Recommendations or strategy drafting errors: Anthropic API key missing or invalid.',
            'Image generation fails on /creatives: Gemini or OpenAI image key missing, or billing disabled on the key. The error message says which.',
            'No Discord notifications: the relevant webhook URL is unset. Notifications fail silently and never block the app, so nothing else will look broken.',
            'A cron never seems to run: it may be getting a 401, check CRON_SECRET matches between Vercel and the environment.',
            'Env var changes in Vercel are Seb. Everything else: raise it as an Ops task on /tasks with priority set honestly.',
          ]} />
        </section>

        {/* Print button, hidden when printing */}
        <div className="mt-8 flex gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="mt-10 pt-6 border-t border-[#1c2035] print:border-gray-200">
          <p className="text-xs text-[#636780] print:text-gray-400">August Marketing, internal use only</p>
        </div>

      </div>
    </div>
  )
}
