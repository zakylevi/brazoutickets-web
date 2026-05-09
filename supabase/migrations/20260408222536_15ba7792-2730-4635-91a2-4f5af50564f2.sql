
-- Add per-seat customization fields
ALTER TABLE public.seats
ADD COLUMN IF NOT EXISTS price text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS label text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false;
