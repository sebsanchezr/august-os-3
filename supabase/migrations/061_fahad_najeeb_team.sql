-- Add Fahad Najeeb to cold calling team
INSERT INTO team_members (
  name,
  email,
  login_email,
  title,
  role,
  status,
  start_date
) VALUES (
  'Fahad Najeeb',
  'fahad_naj@hotmail.com',
  'fahad_naj@hotmail.com',
  'Cold Caller',
  'cold_caller',
  'active',
  CURRENT_DATE
) ON CONFLICT DO NOTHING;
