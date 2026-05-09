CREATE OR REPLACE FUNCTION public.get_org_attendee_counts()
RETURNS TABLE(organization_id uuid, attendee_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.organization_id, COUNT(DISTINCT o.user_id) as attendee_count
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE o.status = 'completed'
  GROUP BY e.organization_id;
$$;