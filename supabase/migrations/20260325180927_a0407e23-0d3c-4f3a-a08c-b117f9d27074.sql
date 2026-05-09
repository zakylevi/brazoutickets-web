
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time text;
