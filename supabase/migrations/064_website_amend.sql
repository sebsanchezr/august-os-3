-- "Amend" action on website_builds: caller sends change notes instead of a
-- flat reject, site gets rebuilt with those changes applied, and the card
-- tracks which version is live. site_design persists the full generated
-- design/copy JSON so an amend can revise it in place rather than
-- regenerating from scratch.

ALTER TABLE website_builds
  ADD COLUMN IF NOT EXISTS revision       INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS site_design    JSONB,
  ADD COLUMN IF NOT EXISTS amend_history  JSONB NOT NULL DEFAULT '[]'::jsonb;
