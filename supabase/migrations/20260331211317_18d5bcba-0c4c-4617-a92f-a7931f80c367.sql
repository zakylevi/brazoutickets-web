ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.refund_order(
  _order_id UUID,
  _refund_amount NUMERIC
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order public.orders%ROWTYPE;
  _event_org_id UUID;
BEGIN
  SELECT *
  INTO _order
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF _order.status = 'refunded' OR _order.refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'Order already refunded';
  END IF;

  IF _refund_amount IS NULL OR _refund_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be greater than zero';
  END IF;

  IF _refund_amount > GREATEST(0, COALESCE(_order.unit_price, 0) * COALESCE(_order.quantity, 1) - COALESCE(_order.discount, 0)) THEN
    RAISE EXCEPTION 'Refund amount exceeds refundable ticket amount';
  END IF;

  SELECT e.organization_id
  INTO _event_org_id
  FROM public.events e
  WHERE e.id = _order.event_id;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = _event_org_id
        AND om.user_id = auth.uid()
        AND om.role = ANY (ARRAY['owner'::public.org_member_role, 'admin'::public.org_member_role])
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to refund this order';
  END IF;

  UPDATE public.orders
  SET status = 'refunded',
      refunded_at = now(),
      refunded_amount = _refund_amount
  WHERE id = _order_id
  RETURNING * INTO _order;

  RETURN _order;
END;
$$;