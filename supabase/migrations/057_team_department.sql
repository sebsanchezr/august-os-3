-- Group team members into departments so the Team page is not one flat list.
-- Adds a `team` axis (distinct from the sales-oriented `role`): C-Suite,
-- Fulfilment, Sales, AI Agents. AI agents are just rows with team = 'ai_agents'.

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT 'fulfilment';

-- Backfill existing rows from their role: callers/managers are the Sales org,
-- everyone else defaults to Fulfilment. Seb can reassign in the UI.
UPDATE team_members
  SET team = 'sales'
  WHERE role IN ('cold_caller', 'sales_manager');
