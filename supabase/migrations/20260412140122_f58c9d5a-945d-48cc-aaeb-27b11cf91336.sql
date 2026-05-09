
-- Add public_ticket_token to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS public_ticket_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Backfill existing rows (they already got default, but ensure uniqueness)
UPDATE public.orders SET public_ticket_token = gen_random_uuid() WHERE public_ticket_token IS NULL;

-- Unique index for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_public_ticket_token ON public.orders(public_ticket_token);

-- Allow anyone to look up an order by token (for ticket validation)
CREATE POLICY "Anyone can look up order by token"
ON public.orders FOR SELECT TO authenticated
USING (true);

-- Validation function: accepts a token + scanner_pin, returns status
CREATE OR REPLACE FUNCTION public.validate_ticket_token(_token uuid, _scanner_pin text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order RECORD;
  _caller_id uuid := auth.uid();
  _is_authorized boolean := false;
BEGIN
  -- Find the order by public token
  SELECT o.*, e.organization_id, e.title AS event_title, e.date AS event_date,
         tt.name AS ticket_name_lookup
  INTO _order
  FROM public.orders o
  JOIN public.events e ON e.id = o.event_id
  LEFT JOIN public.ticket_types tt ON tt.id = o.ticket_type_id
  WHERE o.public_ticket_token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid', 'message', 'Ticket not found');
  END IF;

  -- Check if refunded
  IF _order.status = 'refunded' THEN
    RETURN jsonb_build_object('status', 'invalid', 'message', 'Ticket has been refunded');
  END IF;

  -- Authorization check: org member, admin, team member, or valid scanner PIN
  IF _caller_id IS NOT NULL THEN
    -- Check org membership
    SELECT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = _order.organization_id AND om.user_id = _caller_id
    ) INTO _is_authorized;

    -- Check team invitation with check-in permission
    IF NOT _is_authorized THEN
      SELECT EXISTS (
        SELECT 1 FROM public.team_invitations ti
        WHERE ti.event_id = _order.event_id
          AND ti.accepted_by = _caller_id
          AND ti.status = 'accepted'
      ) INTO _is_authorized;
    END IF;

    -- Check admin role
    IF NOT _is_authorized THEN
      SELECT public.has_role(_caller_id, 'admin') INTO _is_authorized;
    END IF;
  END IF;

  -- Check scanner PIN authorization
  IF NOT _is_authorized AND _scanner_pin IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.scanner_pins sp
      WHERE sp.pin = _scanner_pin AND sp.event_id = _order.event_id
    ) INTO _is_authorized;
  END IF;

  IF NOT _is_authorized THEN
    RETURN jsonb_build_object('status', 'unauthorized', 'message', 'Not authorized to scan tickets');
  END IF;

  -- Check if already checked in
  IF _order.checked_in THEN
    RETURN jsonb_build_object(
      'status', 'already_used',
      'message', 'Ticket already scanned',
      'event_title', _order.event_title,
      'ticket_name', COALESCE(_order.ticket_name_lookup, _order.ticket_name),
      'quantity', _order.quantity
    );
  END IF;

  -- Mark as checked in
  UPDATE public.orders SET checked_in = true WHERE id = _order.id;

  RETURN jsonb_build_object(
    'status', 'valid',
    'message', 'Ticket validated successfully',
    'event_title', _order.event_title,
    'ticket_name', COALESCE(_order.ticket_name_lookup, _order.ticket_name),
    'quantity', _order.quantity,
    'order_id', _order.id
  );
END;
$$;
