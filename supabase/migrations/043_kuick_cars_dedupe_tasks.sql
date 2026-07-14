-- Kuick Cars cleanup: migration 042 assumed the active client had no tasks and
-- generated a fresh set. In fact a fuller task set already existed (created
-- 8 Jul 2026); 042 therefore produced duplicates. This removes the duplicate
-- rows 042 inserted, keeps only the two genuinely-new items (Vercel access
-- blocker, compliance), drops the duplicate content-drive asset, and reflects
-- the in-progress pixel work on the pre-existing pixel task.
--
-- The 042 status advance (form_completed -> building) and asset_links fix were
-- correct and are left untouched.
--
-- Idempotent: matches the exact 042 titles on the active client only.

DO $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT id INTO v_client_id
  FROM clients
  WHERE name ILIKE 'kuick cars' AND archived_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE NOTICE 'No active Kuick Cars client; skipping.';
    RETURN;
  END IF;

  -- Soft-delete the duplicate tasks 042 created (keep Vercel + compliance).
  UPDATE tasks
  SET deleted_at = now()
  WHERE client_id = v_client_id
    AND deleted_at IS NULL
    AND title IN (
      'Onboarding form completed + accesses collected',
      'Log client content drive',
      'Set up Meta Pixel + CAPI (Stape server-side)',
      'Verify GA4 + GTM tracking',
      'Create GoHighLevel account + subdomain',
      'Build campaign structure + audiences',
      'First creative batch from content drive',
      'Extract + segment existing email list',
      'Landing pages for both offers',
      'QA tracking + launch checklist',
      'Go live + start first-week wins'
    );

  -- Drop the duplicate content-drive asset 042 added (pre-existing "Content
  -- Folder" already points at the same drive).
  DELETE FROM client_creative_assets
  WHERE client_id = v_client_id
    AND title = 'Kuick Cars Content Drive (client-shared)';

  -- Reflect the pixel work actually in progress on the pre-existing task.
  UPDATE tasks
  SET status = 'in_progress', updated_at = now()
  WHERE client_id = v_client_id
    AND deleted_at IS NULL
    AND title = 'Create Meta pixel/dataset + record ID'
    AND status = 'this_week';

  RAISE NOTICE 'Kuick Cars dedupe applied for client %', v_client_id;
END $$;
