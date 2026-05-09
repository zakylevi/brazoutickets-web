
-- Add checked_in_at column
ALTER TABLE public.orders ADD COLUMN checked_in_at timestamptz DEFAULT NULL;

-- Update existing checked-in orders to use created_at as fallback
UPDATE public.orders SET checked_in_at = now() WHERE checked_in = true AND checked_in_at IS NULL;

-- Replace validate_ticket_token to also set checked_in_at
CREATE OR REPLACE FUNCTION public.validate_ticket_token(_token text, _scanner_pin text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order record;
  _event record;
  _caller uuid;
  _authorized boolean := false;
BEGIN
  SELECT o.*, e.title as event_title, e.organization_id
  INTO _order
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE o.public_ticket_token::text = _token;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'invalid', 'message', 'Ticket not found');
  END IF;

  IF _order.status = 'refunded' THEN
    RETURN json_build_object('status', 'invalid', 'message', 'Ticket has been refunded');
  END IF;

  _caller := auth.uid();

  IF _caller IS NOT NULL THEN
    IF has_role(_caller, 'admin') THEN
      _authorized := true;
    END IF;
    IF NOT _authorized THEN
      SELECT true INTO _authorized
      FROM organization_members om
      WHERE om.organization_id = _order.organization_id
        AND om.user_id = _caller;
    END IF;
    IF NOT _authorized THEN
      SELECT true INTO _authorized
      FROM team_invitations ti
      WHERE ti.event_id = _order.event_id
        AND ti.accepted_by = _caller
        AND ti.status = 'accepted';
    END IF;
  END IF;

  IF NOT _authorized AND _scanner_pin IS NOT NULL THEN
    SELECT true INTO _authorized
    FROM scanner_pins sp
    WHERE sp.event_id = _order.event_id
      AND sp.pin = _scanner_pin;
  END IF;

  IF NOT _authorized THEN
    RETURN json_build_object('status', 'unauthorized', 'message', 'Not authorized to scan tickets for this event');
  END IF;

  IF _order.checked_in THEN
    RETURN json_build_object(
      'status', 'already_used',
      'message', 'Ticket already scanned',
      'event_title', _order.event_title,
      'ticket_name', _order.ticket_name,
      'quantity', _order.quantity,
      'checked_in_at', _order.checked_in_at
    );
  END IF;

  UPDATE orders SET checked_in = true, checked_in_at = now() WHERE id = _order.id;

  RETURN json_build_object(
    'status', 'valid',
    'message', 'Ticket validated successfully',
    'event_title', _order.event_title,
    'ticket_name', _order.ticket_name,
    'quantity', _order.quantity
  );
END;
$$;
