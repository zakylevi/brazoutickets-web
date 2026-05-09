
CREATE TABLE public.scanner_pins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  pin text NOT NULL,
  label text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.scanner_pins ADD CONSTRAINT scanner_pins_pin_unique UNIQUE (pin);

ALTER TABLE public.scanner_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view scanner pins"
ON public.scanner_pins FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM events e
  JOIN organization_members om ON om.organization_id = e.organization_id
  WHERE e.id = scanner_pins.event_id AND om.user_id = auth.uid()
));

CREATE POLICY "Org admins can create scanner pins"
ON public.scanner_pins FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM events e
  JOIN organization_members om ON om.organization_id = e.organization_id
  WHERE e.id = scanner_pins.event_id AND om.user_id = auth.uid()
  AND om.role = ANY(ARRAY['owner'::org_member_role, 'admin'::org_member_role])
));

CREATE POLICY "Org admins can delete scanner pins"
ON public.scanner_pins FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM events e
  JOIN organization_members om ON om.organization_id = e.organization_id
  WHERE e.id = scanner_pins.event_id AND om.user_id = auth.uid()
  AND om.role = ANY(ARRAY['owner'::org_member_role, 'admin'::org_member_role])
));
