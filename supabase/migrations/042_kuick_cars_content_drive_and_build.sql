-- Kuick Cars: log the client-shared content drive, advance onboarding into the
-- build phase, and generate a real onboarding task set against the ACTIVE
-- client row.
--
-- Context: the active Kuick Cars client (non-archived) currently has zero tasks
-- because migration 024's seeded pre_kickoff tasks resolved against an earlier
-- bare/duplicate row that was later archived. This migration attaches work to
-- the live client so the Assets tab checklist and task board actually show it.
--
-- Real state as of 14 Jul 2026: onboarding form completed, all platform accesses
-- collected except Vercel, Meta Pixel/CAPI setup in progress, GoHighLevel not yet
-- created. Full-service scope (paid ads, email/CRM, website, landing pages).
--
-- Idempotent: resolves the active client by name, guards every insert/update on
-- existence, and only advances the onboarding status forward.

DO $$
DECLARE
  v_client_id     UUID;
  v_onboarding_id UUID;
  v_drive_url     TEXT := 'https://drive.google.com/drive/folders/1HfcNRgNH0yOAf_Crbl_80UCsKHo1DFYm';
  rec             RECORD;
BEGIN
  -- Active (non-archived) Kuick Cars client only.
  SELECT id, onboarding_id INTO v_client_id, v_onboarding_id
  FROM clients
  WHERE name ILIKE 'kuick cars' AND archived_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE NOTICE 'No active Kuick Cars client found; skipping.';
    RETURN;
  END IF;

  -- ─── 1. Content drive shared by the client ────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM client_creative_assets
    WHERE client_id = v_client_id AND url = v_drive_url
  ) THEN
    INSERT INTO client_creative_assets (client_id, title, kind, url, notes)
    VALUES (
      v_client_id,
      'Kuick Cars Content Drive (client-shared)',
      'drive',
      v_drive_url,
      'Client-shared master content drive. Subfolders: Ads (existing ad assets), 2026, 2025, 2024, 2023 (fleet + shoot content by year). Owner nikhiljadeja98@gmail.com (client side). Source for creative batches.'
    );
  END IF;

  -- ─── 2. Onboarding form: replace the "pending" asset_links placeholder ─────
  IF v_onboarding_id IS NOT NULL THEN
    UPDATE onboarding_forms
    SET asset_links = 'Content drive shared: ' || v_drive_url ||
                      ' (folders: Ads, 2026, 2025, 2024, 2023). Brand guidelines doc still to confirm.'
    WHERE onboarding_id = v_onboarding_id
      AND (asset_links IS NULL OR asset_links ILIKE 'pending%');

    -- ─── 3. Advance onboarding into the build phase ──────────────────────────
    UPDATE onboardings
    SET status = 'building',
        internal_brief = 'Full-service car hire client. Month 1 build 3,500 GBP, then 5,000/mo. '
                       || 'Two offers: chauffeur + self-drive supercar. Scope: paid ads (Meta + Google), '
                       || 'CRM + email (GoHighLevel), website fixes, landing pages. '
                       || 'Accesses collected except Vercel. Meta Pixel/CAPI setup in progress. GHL not yet created.',
        updated_at = now()
    WHERE id = v_onboarding_id
      AND status IN ('signed', 'form_completed', 'kickoff_booked', 'kickoff_held');
  END IF;

  -- ─── 4. Generate the onboarding task set against the active client ─────────
  -- Ops statuses: backlog | this_week | in_progress | blocked | review | done.
  -- Only inserts a task if one with the same title does not already exist live.
  FOR rec IN
    SELECT * FROM (VALUES
      -- Already done
      ('Onboarding form completed + accesses collected', 'Form submitted, all platform accesses in except Vercel. Meta BP/Ad Account, Google Ads, GTM, GA4, DNS, dev contact captured.', 'ops', 'client',   'done',        'high',   NULL::text),
      ('Log client content drive',                       'Client-shared master content drive logged to Assets (Ads + 2023-2026 fleet content).',                                       'ops', 'client',   'done',        'normal', NULL),
      -- In flight
      ('Set up Meta Pixel + CAPI (Stape server-side)',   'Stand up pixel + Conversions API via GTM + Stape (data.kuickcars.com) on the Meta Ad Account. No pixel existed before.',       'ops', 'paid_ads', 'in_progress', 'urgent', NULL),
      -- Blocked
      ('Get Vercel access from client',                  'Only outstanding access. Chase Almas/Ali for Vercel team invite so we can ship landing pages.',                              'ops', 'client',   'blocked',     'high',   'Client has not granted Vercel access yet'),
      -- This week
      ('Verify GA4 + GTM tracking',                      'Confirm GA4 property 15220935741 + GTM-NT9LHD4W are firing correctly and events map to key actions (quote/booking).',         'ops', 'paid_ads', 'this_week',   'high',   NULL),
      ('Create GoHighLevel account + subdomain',         'Spin up the GHL sub-account for CRM + email, wire mail.kuickcars.com sending domain. Decide agency-billed vs client-billed.', 'ops', 'client',   'this_week',   'high',   NULL),
      ('Build campaign structure + audiences',           'Meta + Google Search campaign structure, audiences, and budgets for the two offers (chauffeur + self-drive).',               'ops', 'paid_ads', 'this_week',   'high',   NULL),
      ('First creative batch from content drive',        'First ad creative batch pulled from the content drive, aligned to chauffeur + self-drive offers.',                          'creative', 'creative', 'brief',   'high',   NULL),
      -- Backlog / build + launch
      ('Extract + segment existing email list',          'Pull customer emails from the rental software, segment, and confirm consent basis before any email sends.',                  'ops', 'client',   'backlog',     'normal', NULL),
      ('Privacy + cookie policy compliance',             'Advise on privacy + cookie policy for tracking/CAPI and email consent. Client flagged as needed.',                          'ops', 'client',   'backlog',     'normal', NULL),
      ('Landing pages for both offers',                  'Build/fix landing pages for chauffeur + self-drive with tracking. Blocked on Vercel access.',                              'ops', 'client',   'backlog',     'normal', NULL),
      ('QA tracking + launch checklist',                 'Verify pixel, CAPI, UTMs, budgets, and billing across Meta + Google before going live.',                                   'ops', 'paid_ads', 'backlog',     'high',   NULL),
      ('Go live + start first-week wins',                'Launch campaigns. Marks the start of the daily first-week wins engine and weekly reporting into the OS.',                   'ops', 'paid_ads', 'backlog',     'high',   NULL)
    ) AS v(title, description, track, department, status, priority, blocked_reason)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM tasks
      WHERE client_id = v_client_id AND title = rec.title AND deleted_at IS NULL
    ) THEN
      INSERT INTO tasks (title, description, track, department, client_id, status, priority, source, blocked_reason, completed_at)
      VALUES (
        rec.title, rec.description, rec.track, rec.department, v_client_id,
        rec.status, rec.priority, 'manual', rec.blocked_reason,
        CASE WHEN rec.status IN ('done', 'live') THEN now() ELSE NULL END
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Kuick Cars build kickoff applied for client %', v_client_id;
END $$;
