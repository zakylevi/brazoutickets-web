CREATE OR REPLACE FUNCTION public.validate_ticket_token(_token text, _scanner_pin text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order record;
BEGIN
  SELECT o.*, e.title as event_title, e.id as event_id_val
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

  IF _order.checked_in THEN
    RETURN json_build_object('status', 'already_used', 'event_id', _order.event_id_val, 'event_title', _order.event_title, 'ticket_name', _order.ticket_name, 'quantity', _order.quantity, 'checked_in_at', _order.checked_in_at);
  END IF;

  UPDATE orders SET checked_in = true, checked_in_at = now(), status = 'SCANNED' WHERE id = _order.id;

  RETURN json_build_object('status', 'valid', 'event_id', _order.event_id_val, 'event_title', _order.event_title, 'ticket_name', _order.ticket_name, 'quantity', _order.quantity, 'order_id', _order.id);
END;
$$;