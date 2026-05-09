ALTER TABLE public.events ADD COLUMN explore_clicks integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_event_explore_clicks(_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.events SET explore_clicks = explore_clicks + 1 WHERE id = _event_id;
$$;