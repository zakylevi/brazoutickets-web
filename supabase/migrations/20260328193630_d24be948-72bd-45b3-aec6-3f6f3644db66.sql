
ALTER TABLE public.events ADD COLUMN instagram_clicks integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_event_instagram_clicks(_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.events SET instagram_clicks = instagram_clicks + 1 WHERE id = _event_id;
$$;
