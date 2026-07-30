-- Add Bernice Okpara, Aristarque Anakambi, Afolabi Akeju to cold calling team
INSERT INTO team_members (
  name,
  email,
  login_email,
  title,
  role,
  status,
  start_date
) VALUES
  ('Bernice Okpara', 'berniceokpara07@gmail.com', 'berniceokpara07@gmail.com', 'Cold Caller', 'cold_caller', 'active', CURRENT_DATE),
  ('Aristarque Anakambi', 'aristarqueanakambi@hotmail.com', 'aristarqueanakambi@hotmail.com', 'Cold Caller', 'cold_caller', 'active', CURRENT_DATE),
  ('Afolabi Akeju', 'aakeju8@gmail.com', 'aakeju8@gmail.com', 'Cold Caller', 'cold_caller', 'active', CURRENT_DATE)
ON CONFLICT DO NOTHING;
