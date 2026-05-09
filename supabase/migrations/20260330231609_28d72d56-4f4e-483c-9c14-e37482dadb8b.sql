
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS billing_zip text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram text DEFAULT '';
