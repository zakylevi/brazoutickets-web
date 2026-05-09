CREATE OR REPLACE FUNCTION public.resolve_team_invitation(_token uuid)
RETURNS TABLE(
  id uuid,
  event_id uuid,
  organization_id uuid,
  email text,
  role text,
  status text,
  permissions jsonb,
  invited_by uuid,
  accepted_by uuid,
  org_name text,
  org_slug text,
  event_title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ti.id,
    ti.event_id,
    ti.organization_id,
    ti.email,
    ti.role,
    ti.status,
    ti.permissions,
    ti.invited_by,
    ti.accepted_by,
    o.name AS org_name,
    o.slug AS org_slug,
    e.title AS event_title
  FROM public.team_invitations ti
  LEFT JOIN public.organizations o ON o.id = ti.organization_id
  LEFT JOIN public.events e ON e.id = ti.event_id
  WHERE ti.token = _token
  LIMIT 1;
$$;