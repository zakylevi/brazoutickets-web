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

  SELECT * INTO _inv FROM public.team_invitations WHERE token = _token;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  
  IF _inv.status != 'pending' THEN
    RAISE EXCEPTION 'Invitation already %', _inv.status;
  END IF;

  -- Update invitation
  UPDATE public.team_invitations
  SET status = 'accepted', accepted_by = _user_id, updated_at = now()
  WHERE id = _inv.id;

  -- Add as org member if not already
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_inv.organization_id, _user_id, 'member')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', _inv.organization_id,
    'event_id', _inv.event_id
  );
END;
$$;