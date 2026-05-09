CREATE OR REPLACE FUNCTION public.resolve_tracking_link(_slug text)
RETURNS TABLE (event_id uuid, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tl.event_id, tl.slug
  FROM public.tracking_links tl
  WHERE lower(trim(tl.slug)) = lower(trim(_slug))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_tracking_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_tracking_link(text) TO anon, authenticated;