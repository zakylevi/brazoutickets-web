ALTER TABLE public.tracking_links ADD COLUMN IF NOT EXISTS clicks integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_tracking_link_clicks(_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tracking_links
  SET clicks = clicks + 1
  WHERE lower(trim(slug)) = lower(trim(_slug));
$$;

REVOKE ALL ON FUNCTION public.increment_tracking_link_clicks(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_tracking_link_clicks(text) TO anon, authenticated;