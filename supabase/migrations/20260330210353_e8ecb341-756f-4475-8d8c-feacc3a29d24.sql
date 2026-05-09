
-- Create tracking_links table to persist custom tracking links
CREATE TABLE public.tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label text NOT NULL,
  slug text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one slug per event
ALTER TABLE public.tracking_links ADD CONSTRAINT tracking_links_event_slug_unique UNIQUE (event_id, slug);

-- Enable RLS
ALTER TABLE public.tracking_links ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view tracking links for events they have access to
CREATE POLICY "Org members can view tracking links"
  ON public.tracking_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN organization_members om ON om.organization_id = e.organization_id
      WHERE e.id = tracking_links.event_id AND om.user_id = auth.uid()
    )
  );

-- Admins can view all tracking links
CREATE POLICY "Admins can view all tracking links"
  ON public.tracking_links FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Org members (owner/admin) can create tracking links
CREATE POLICY "Org members can create tracking links"
  ON public.tracking_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      JOIN organization_members om ON om.organization_id = e.organization_id
      WHERE e.id = tracking_links.event_id AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Admins can create tracking links
CREATE POLICY "Admins can create tracking links"
  ON public.tracking_links FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Org members (owner/admin) can delete tracking links
CREATE POLICY "Org members can delete tracking links"
  ON public.tracking_links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN organization_members om ON om.organization_id = e.organization_id
      WHERE e.id = tracking_links.event_id AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Admins can delete tracking links
CREATE POLICY "Admins can delete tracking links"
  ON public.tracking_links FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));
