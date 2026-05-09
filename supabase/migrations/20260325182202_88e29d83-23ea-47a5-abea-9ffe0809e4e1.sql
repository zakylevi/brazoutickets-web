
-- Ticket types for events
CREATE TABLE public.ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  price text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 100,
  sold integer NOT NULL DEFAULT 0,
  sold_out boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  available_soon boolean NOT NULL DEFAULT false,
  available_date text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket types are viewable by everyone" ON public.ticket_types FOR SELECT USING (true);
CREATE POLICY "Org members can manage ticket types" ON public.ticket_types FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = ticket_types.event_id AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Org members can update ticket types" ON public.ticket_types FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = ticket_types.event_id AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Org members can delete ticket types" ON public.ticket_types FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = ticket_types.event_id AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- Complimentary tickets
CREATE TABLE public.comp_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  ticket_type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comp_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comp tickets viewable by org members" ON public.comp_tickets FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = comp_tickets.event_id AND om.user_id = auth.uid()
  )
);
CREATE POLICY "Org members can create comp tickets" ON public.comp_tickets FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = comp_tickets.event_id AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Org members can delete comp tickets" ON public.comp_tickets FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = comp_tickets.event_id AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- Promo codes
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  ticket_type text NOT NULL DEFAULT 'all',
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value text NOT NULL,
  max_uses integer NOT NULL DEFAULT 50,
  used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Promo codes viewable by org members" ON public.promo_codes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = promo_codes.event_id AND om.user_id = auth.uid()
  )
);
CREATE POLICY "Org members can create promo codes" ON public.promo_codes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = promo_codes.event_id AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Org members can update promo codes" ON public.promo_codes FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = promo_codes.event_id AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Org members can delete promo codes" ON public.promo_codes FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = promo_codes.event_id AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);
