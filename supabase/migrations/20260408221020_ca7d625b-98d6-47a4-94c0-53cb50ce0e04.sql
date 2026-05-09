
-- Add event_type to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'general_admission';

-- Create seating_sections table
CREATE TABLE public.seating_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  rows_count integer NOT NULL DEFAULT 1,
  seats_per_row integer NOT NULL DEFAULT 10,
  price text NOT NULL DEFAULT '0',
  is_general_admission boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  capacity integer GENERATED ALWAYS AS (rows_count * seats_per_row) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seating_sections ENABLE ROW LEVEL SECURITY;

-- Anyone can view sections
CREATE POLICY "Anyone can view seating sections"
  ON public.seating_sections FOR SELECT
  USING (true);

-- Org members can manage sections
CREATE POLICY "Org members can create seating sections"
  ON public.seating_sections FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM events e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = seating_sections.event_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ));

CREATE POLICY "Org members can update seating sections"
  ON public.seating_sections FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM events e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = seating_sections.event_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ));

CREATE POLICY "Org members can delete seating sections"
  ON public.seating_sections FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM events e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = seating_sections.event_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ));

-- Create seats table
CREATE TABLE public.seats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id uuid NOT NULL REFERENCES public.seating_sections(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  row_label text NOT NULL,
  seat_number integer NOT NULL,
  status text NOT NULL DEFAULT 'available',
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, row_label, seat_number)
);

ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

-- Anyone can view seats (needed for seat map display)
CREATE POLICY "Anyone can view seats"
  ON public.seats FOR SELECT
  USING (true);

-- Org members can manage seats
CREATE POLICY "Org members can create seats"
  ON public.seats FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM events e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = seats.event_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ));

CREATE POLICY "Org members can update seats"
  ON public.seats FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM events e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = seats.event_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ));

CREATE POLICY "Org members can delete seats"
  ON public.seats FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM events e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = seats.event_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ));

-- Create indexes for performance
CREATE INDEX idx_seating_sections_event_id ON public.seating_sections(event_id);
CREATE INDEX idx_seats_section_id ON public.seats(section_id);
CREATE INDEX idx_seats_event_id ON public.seats(event_id);
CREATE INDEX idx_seats_order_id ON public.seats(order_id);
CREATE INDEX idx_seats_status ON public.seats(status);
