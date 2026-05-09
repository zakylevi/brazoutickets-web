ALTER TABLE public.events ADD COLUMN clicks integer NOT NULL DEFAULT 0;

-- Create a function to increment clicks (bypasses RLS)
CREATE OR REPLACE FUNCTION public.increment_event_clicks(_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.events SET clicks = clicks + 1 WHERE id = _event_id;
$$;