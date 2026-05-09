
-- Allow org members to view profiles of users who purchased tickets for their events
CREATE POLICY "Org members can view attendee profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN events e ON e.id = o.event_id
      JOIN organization_members om ON om.organization_id = e.organization_id
      WHERE o.user_id = profiles.user_id AND om.user_id = auth.uid()
    )
  );
