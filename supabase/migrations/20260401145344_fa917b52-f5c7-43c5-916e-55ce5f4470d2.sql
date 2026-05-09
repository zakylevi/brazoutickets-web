
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS location_state text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS postal_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS place_id text NOT NULL DEFAULT '';
