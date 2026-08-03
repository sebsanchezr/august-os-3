-- Auto-build pipeline: request now kicks off research + design + deploy inline
-- (no more manual "approve to start build" gate). This column stores the
-- generated sales-call brief so it renders on the profile alongside the demo
-- site link, not just inside the one-off Discord message.

ALTER TABLE website_builds
  ADD COLUMN IF NOT EXISTS brief_summary   TEXT,
  ADD COLUMN IF NOT EXISTS brief_talking_points TEXT[],
  ADD COLUMN IF NOT EXISTS brief_objection_prep TEXT[],
  ADD COLUMN IF NOT EXISTS build_error      TEXT;
