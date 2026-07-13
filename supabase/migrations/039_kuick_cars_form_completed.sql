-- Kuick Cars has completed the onboarding form. Move its onboarding from
-- 'signed' to 'form_completed' so it lands in the right column of the
-- Onboarding board. Only advances a still-signed record (never regresses one
-- that has already moved past form_completed), so it is safe to re-run.
UPDATE onboardings
SET status = 'form_completed',
    form_completed_at = COALESCE(form_completed_at, now()),
    updated_at = now()
WHERE company_name ILIKE 'kuick cars'
  AND status = 'signed';
