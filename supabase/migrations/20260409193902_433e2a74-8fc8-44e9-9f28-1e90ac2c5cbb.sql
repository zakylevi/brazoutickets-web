CREATE OR REPLACE FUNCTION public.resolve_seated_ticket_type(_event_id uuid, _name text, _price text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ticket_type_id uuid;
BEGIN
  -- Try to find existing ticket_type for this event+name
  SELECT id INTO _ticket_type_id
  FROM public.ticket_types
  WHERE event_id = _event_id AND name = _name
  LIMIT 1;

  IF _ticket_type_id IS NOT NULL THEN
    RETURN _ticket_type_id;
  END IF;

  -- Create a new hidden ticket_type for this seated section
  INSERT INTO public.ticket_types (event_id, name, price, quantity, hidden)
  VALUES (_event_id, _name, _price, 99999, true)
  RETURNING id INTO _ticket_type_id;

  RETURN _ticket_type_id;
END;
$$;