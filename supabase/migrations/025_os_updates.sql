-- OS Updates: a lightweight changelog for the team. Shows what has shipped and
-- what is being built. Any code or agent can append a row via lib/updates.ts
-- (logUpdate) or POST /api/updates. The Updates page reads the latest rows.

CREATE TABLE IF NOT EXISTS os_updates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  tag         TEXT CHECK (tag IN ('New', 'Fix', 'Building', 'Improved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE os_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_os_updates" ON os_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_os_updates_created_at ON os_updates(created_at DESC);

-- Seed with recent real updates from the completed build plans. ON CONFLICT is
-- not needed (fresh table), but keep inserts idempotent-friendly by title+date.
INSERT INTO os_updates (title, description, tag, created_at) VALUES
  ('Gov Contracts positive-reply count fixed', 'The Command Center funnel was counting bid-process statuses (bid_drafted, submitted, won, lost) as positive replies. It now only counts genuine inbound buyer replies (replied, meeting), so the number reflects reality.', 'Fix', NOW()),
  ('Pipeline leads are now editable', 'Click any lead card on the Pipeline board to open an edit drawer and change name, company, deal value, source, probability, dates and notes. The board also scrolls cleanly on narrow screens instead of columns overlapping.', 'New', NOW() - INTERVAL '1 hour'),
  ('Updates tab added', 'This changelog. A running log of what has shipped and what is being built so the whole team can see progress in one place.', 'New', NOW() - INTERVAL '2 hours'),
  ('Coming Soon items removed from the menu', 'The side menu now only shows live sections. No more locked placeholders.', 'Improved', NOW() - INTERVAL '3 hours'),
  ('Onboarding system live', 'World-class onboarding flow with a signed welcome portal, paid-gate launch, first-week wins, VSL and master contract assets. New clients now flow from won deal straight into onboarding.', 'New', NOW() - INTERVAL '4 days'),
  ('Ad Creative Engine', 'Second core service wired in: a weekly, data-driven AI creative pipeline that turns performance data into new ad concepts.', 'New', NOW() - INTERVAL '9 days'),
  ('Meetings and Comms engine', 'Full meeting lifecycle plus a comms SLA engine with a two-way Discord bot, so nothing said to a client slips through the cracks.', 'New', NOW() - INTERVAL '16 days'),
  ('Sales Calls workspace', 'Log sales calls, score them against the rubric, and surface insights. Full sales call detail and reporting in the Sales section.', 'New', NOW() - INTERVAL '23 days'),
  ('Task Manager replaces Notion', 'The Tasks tab is now the single source of truth for work: board, list and archive views, Discord-first notifications and a daily WhatsApp digest.', 'New', NOW() - INTERVAL '30 days'),
  ('Account Management build', 'Client grid, account HQ, approvals queue, issues board, meeting invites (ICS, Resend, Google Calendar) and client plus internal PDF report views.', 'New', NOW() - INTERVAL '38 days');
