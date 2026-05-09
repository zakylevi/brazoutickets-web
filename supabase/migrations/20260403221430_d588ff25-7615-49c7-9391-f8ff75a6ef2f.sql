
-- Allow promoters with view_attendees permission to see orders for their event
CREATE POLICY "Promoters with view_attendees can view event orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_invitations ti
    WHERE ti.event_id = orders.event_id
      AND ti.accepted_by = auth.uid()
      AND ti.status = 'accepted'
      AND ti.permissions @> '["view_attendees"]'::jsonb
  )
);

-- Allow promoters with view_attendees permission to see attendee profiles
CREATE POLICY "Promoters with view_attendees can view attendee profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.team_invitations ti
      ON ti.event_id = o.event_id
      AND ti.accepted_by = auth.uid()
      AND ti.status = 'accepted'
      AND ti.permissions @> '["view_attendees"]'::jsonb
    WHERE o.user_id = profiles.user_id
  )
);
