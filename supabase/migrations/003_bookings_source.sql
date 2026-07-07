-- Add source and niche columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'cold_call'
    CHECK (source IN ('cold_call', 'cal_com', 'referral', 'other')),
  ADD COLUMN IF NOT EXISTS niche TEXT;

-- Tag the Luxury Roofing booking as cal_com
UPDATE bookings
  SET source = 'cal_com', niche = 'roofing'
  WHERE business_name = 'Luxury Roofing Ltd' AND source IS NULL;
