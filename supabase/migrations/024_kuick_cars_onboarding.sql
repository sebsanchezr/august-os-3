-- Kuick Cars: new signed client + onboarding kickoff.
-- Kuick Cars (car hire: chauffeur + self-drive) signed the paid ads contract.
-- Pricing from Kuick_Cars_Proposal: Month 1 build 3,500 GBP one-off, then
-- 5,000 GBP/month ongoing retainer. So the onboarding fee_amount is the 3,500
-- build fee and the client MRR is the 5,000 ongoing retainer.
--
-- PLACEHOLDERS (flagged for Seb to fill in): the proposal does not state the
-- client contact name or email, so a placeholder contact is used below. Update
-- clients.contact_email / contact_name and onboardings.contact_email /
-- contact_name once known, otherwise the welcome email and invoice cannot go
-- to the right person.
--
-- Idempotent: guarded by name/company lookups so a re-run does not duplicate.

-- ─── Seed paid_ads onboarding task templates (Phase 5 of the onboarding plan,
--      never seeded until now). Keyed by service='paid_ads'. ─────────────────
INSERT INTO onboarding_task_templates (service, title, description, owner_role, offset_days, phase, sort)
SELECT * FROM (VALUES
  ('paid_ads', 'Collect ad account + pixel access',        'Get Meta Business Manager + Google Ads access, confirm pixel/conversions API is firing.', 'media_buyer',      0, 'pre_kickoff', 10),
  ('paid_ads', 'Collect brand assets + guidelines',        'Logos, fonts, product imagery, tone of voice, any existing creative.',                      'account_manager',  0, 'pre_kickoff', 20),
  ('paid_ads', 'Confirm offers + landing pages',           'Confirm the offers to run (chauffeur vs self-drive) and that landing pages/tracking are live.', 'account_manager', 1, 'pre_kickoff', 30),
  ('paid_ads', 'Kickoff call: strategy + expectations',    'Hold the kickoff call. Align on goals, budget, reporting cadence, comms channel.',          'owner',            2, 'pre_kickoff', 40),
  ('paid_ads', 'Build audience + campaign structure',      'Set up campaign structure, audiences, and budgets from the strategy brief.',                'media_buyer',      3, 'build',       10),
  ('paid_ads', 'Produce first creative batch',             'First batch of ad creatives for launch, aligned to the two offers.',                        'editor',           4, 'build',       20),
  ('paid_ads', 'QA tracking + launch checklist',           'Verify pixel, conversions, UTMs, budgets, and billing before going live.',                  'media_buyer',      5, 'launch',      10),
  ('paid_ads', 'Go live + start first-week wins',          'Launch campaigns. Marks the start of the daily first-week wins engine.',                    'owner',            6, 'launch',      20)
) AS v(service, title, description, owner_role, offset_days, phase, sort)
WHERE NOT EXISTS (
  SELECT 1 FROM onboarding_task_templates t WHERE t.service = 'paid_ads' AND t.title = v.title
);

DO $$
DECLARE
  v_client_id     UUID;
  v_onboarding_id UUID;
  v_contact_name  TEXT := 'Kuick Cars Contact';           -- PLACEHOLDER
  v_contact_email TEXT := 'contact@kuickcars.co.uk';       -- PLACEHOLDER
  tmpl            RECORD;
BEGIN
  -- Client: adopt an existing bare Kuick Cars row if one exists, else create.
  SELECT id INTO v_client_id
  FROM clients WHERE name ILIKE 'kuick cars' ORDER BY created_at ASC LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO clients (name, status, services, contact_name, contact_email, mrr, currency, notes)
    VALUES ('Kuick Cars', 'active', ARRAY['paid_ads'], v_contact_name, v_contact_email, 5000, 'GBP',
            'Car hire (chauffeur + self-drive). Signed paid ads: 3,500 build + 5,000/mo retainer. Contact name/email are PLACEHOLDERS pending real details.')
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE clients
    SET status = 'active', services = ARRAY['paid_ads'], mrr = 5000, currency = 'GBP'
    WHERE id = v_client_id;
  END IF;

  -- Onboarding record: contract already signed, portal live, not yet launched.
  SELECT id INTO v_onboarding_id FROM onboardings WHERE company_name ILIKE 'kuick cars' LIMIT 1;

  IF v_onboarding_id IS NULL THEN
    INSERT INTO onboardings (
      client_id, company_name, contact_name, contact_email, service, deliverables,
      fee_amount, currency, status, portal_token, contract_signed_at, paid, internal_brief
    )
    VALUES (
      v_client_id, 'Kuick Cars', v_contact_name, v_contact_email,
      'Paid Ads Management',
      'Google Search + Meta management across chauffeur and self-drive offers, email marketing activation, weekly optimisation and one strategic recommendation per week, monthly reporting into the OS.',
      3500, 'GBP', 'signed',
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      now(), false,
      'Car hire client. Month 1 build 3,500 GBP, then 5,000/mo. Two offers: chauffeur and self-drive. Contact details are placeholders pending confirmation.'
    )
    RETURNING id INTO v_onboarding_id;

    UPDATE clients SET onboarding_id = v_onboarding_id WHERE id = v_client_id;
  END IF;

  -- Kick off the flow: create actual pre_kickoff tasks for Kuick Cars from the
  -- paid_ads templates so the team has an actionable checklist immediately.
  FOR tmpl IN
    SELECT * FROM onboarding_task_templates WHERE service = 'paid_ads' AND phase = 'pre_kickoff' ORDER BY sort
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM tasks WHERE client_id = v_client_id AND title = tmpl.title AND deleted_at IS NULL
    ) THEN
      INSERT INTO tasks (title, description, track, department, client_id, status, priority, source)
      VALUES (tmpl.title, COALESCE(tmpl.description, ''), 'ops', 'client', v_client_id, 'this_week', 'high', 'manual');
    END IF;
  END LOOP;
END $$;
