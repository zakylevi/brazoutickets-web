ALTER TABLE public.orders ADD COLUMN billing_city text DEFAULT '';
ALTER TABLE public.orders ADD COLUMN billing_state text DEFAULT '';
ALTER TABLE public.orders ADD COLUMN billing_country text DEFAULT '';