
-- Orders table to track real purchases
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  ticket_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  service_fee numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  promo_code text,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  ref_source text NOT NULL DEFAULT 'direct',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own orders
CREATE POLICY "Users can insert own orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Org members can view orders for their events
CREATE POLICY "Org members can view event orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN organization_members om ON om.organization_id = e.organization_id
      WHERE e.id = orders.event_id AND om.user_id = auth.uid()
    )
  );

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to atomically increment ticket sold count
CREATE OR REPLACE FUNCTION public.purchase_tickets(
  _ticket_type_id uuid,
  _quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ticket_types
  SET sold = sold + _quantity,
      sold_out = CASE WHEN sold + _quantity >= quantity THEN true ELSE false END
  WHERE id = _ticket_type_id;
END;
$$;
