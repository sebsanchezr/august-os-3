-- Deterministic post-build quality check (lib/site-builder/quality.ts), run
-- independently of the AI call so a silently degraded build (Apify found
-- nothing, Sonnet fell back, a filler phrase slipped through) shows up as
-- "Needs review" on the card instead of looking identical to a good one.
ALTER TABLE website_builds
  ADD COLUMN IF NOT EXISTS quality_passed   BOOLEAN,
  ADD COLUMN IF NOT EXISTS quality_warnings TEXT[];
