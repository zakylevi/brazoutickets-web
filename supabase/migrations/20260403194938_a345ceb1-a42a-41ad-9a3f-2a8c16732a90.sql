CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv RECORD;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _inv
  FROM public.team_invitations
  WHERE token = _token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF _inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation already %', _inv.status;
  END IF;

  UPDATE public.team_invitations
  SET status = 'accepted',
      accepted_by = _user_id,
      updated_at = now()
  WHERE id = _inv.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', _inv.organization_id,
    'event_id', _inv.event_id,
    'role', _inv.role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_team_members(_event_id uuid)
RETURNS TABLE(
  id uuid,
  email text,
  role text,
  status text,
  permissions jsonb,
  accepted_by uuid,
  name text,
  avatar_url text,
  total_clicks bigint,
  total_sales bigint,
  total_revenue numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target_event AS (
    SELECT e.id, e.organization_id
    FROM public.events e
    WHERE e.id = _event_id
  ),
  authorized AS (
    SELECT 1
    FROM target_event te
    WHERE public.has_role(auth.uid(), 'admin')
       OR EXISTS (
         SELECT 1
         FROM public.organization_members om
         WHERE om.organization_id = te.organization_id
           AND om.user_id = auth.uid()
       )
  )
  SELECT
    ti.id,
    ti.email,
    ti.role,
    ti.status,
    ti.permissions,
    ti.accepted_by,
    COALESCE(p.name, split_part(ti.email, '@', 1)) AS name,
    p.avatar_url,
    COALESCE(link_metrics.total_clicks, 0)::bigint AS total_clicks,
    COALESCE(order_metrics.total_sales, 0)::bigint AS total_sales,
    COALESCE(order_metrics.total_revenue, 0)::numeric AS total_revenue
  FROM public.team_invitations ti
  JOIN target_event te
    ON te.id = ti.event_id
  JOIN authorized a
    ON true
  LEFT JOIN public.profiles p
    ON p.user_id = ti.accepted_by
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(tl.clicks), 0)::bigint AS total_clicks
    FROM public.tracking_links tl
    WHERE tl.event_id = ti.event_id
      AND tl.created_by = ti.accepted_by
  ) AS link_metrics ON true
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(o.quantity), 0)::bigint AS total_sales,
      COALESCE(SUM((COALESCE(o.unit_price, 0) * COALESCE(o.quantity, 1)) - COALESCE(o.discount, 0)), 0)::numeric AS total_revenue
    FROM public.tracking_links tl
    JOIN public.orders o
      ON o.event_id = tl.event_id
     AND o.ref_source = tl.slug
     AND o.status = 'completed'
    WHERE tl.event_id = ti.event_id
      AND tl.created_by = ti.accepted_by
  ) AS order_metrics ON true
  WHERE ti.event_id = _event_id
  ORDER BY ti.created_at DESC;
$$;