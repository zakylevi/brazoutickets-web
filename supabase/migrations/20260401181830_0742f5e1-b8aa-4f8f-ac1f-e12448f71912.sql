
-- Add approval_required column to ticket_types
ALTER TABLE public.ticket_types ADD COLUMN approval_required boolean NOT NULL DEFAULT false;

-- Create ticket_requests table
CREATE TABLE public.ticket_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  quantity integer NOT NULL DEFAULT 1,
  message text DEFAULT '',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
  ON public.ticket_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create requests
CREATE POLICY "Users can create requests"
  ON public.ticket_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Org members can view requests for their events
CREATE POLICY "Org members can view event requests"
  ON public.ticket_requests FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM events e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = ticket_requests.event_id AND om.user_id = auth.uid()
  ));

-- Org owners/admins can update requests (approve/reject)
CREATE POLICY "Org members can update requests"
  ON public.ticket_requests FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM events e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = ticket_requests.event_id AND om.user_id = auth.uid()
    AND om.role = ANY (ARRAY['owner'::org_member_role, 'admin'::org_member_role])
  ));

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
  ON public.ticket_requests FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
