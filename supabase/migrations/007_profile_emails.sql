-- Add email to profiles so meeting invites can address the team.
-- Populate from auth.users where possible, then fill any gaps manually.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill from auth.users (matches on id)
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND p.email IS NULL;
