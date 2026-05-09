
-- Allow team members with edit_event_tickets to manage ticket types
CREATE POLICY "Team members with edit_event_tickets can update ticket types"
ON public.ticket_types
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_invitations ti
    WHERE ti.event_id = ticket_types.event_id
      AND ti.accepted_by = auth.uid()
      AND ti.status = 'accepted'
      AND ti.permissions @> '["edit_event_tickets"]'::jsonb
  )
);

CREATE POLICY "Team members with edit_event_tickets can insert ticket types"
ON public.ticket_types
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.team_invitations ti
    WHERE ti.event_id = ticket_types.event_id
      AND ti.accepted_by = auth.uid()
      AND ti.status = 'accepted'
      AND ti.permissions @> '["edit_event_tickets"]'::jsonb
  )
);

CREATE POLICY "Team members with edit_event_tickets can delete ticket types"
ON public.ticket_types
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_invitations ti
    WHERE ti.event_id = ticket_types.event_id
      AND ti.accepted_by = auth.uid()
      AND ti.status = 'accepted'
      AND ti.permissions @> '["edit_event_tickets"]'::jsonb
  )
);

-- Allow team members with view_send_comp_tickets to view and create comp tickets
CREATE POLICY "Team members with comp_tickets perm can view comp tickets"
ON public.comp_tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_invitations ti
    WHERE ti.event_id = comp_tickets.event_id
      AND ti.accepted_by = auth.uid()
      AND ti.status = 'accepted'
      AND ti.permissions @> '["view_send_comp_tickets"]'::jsonb
  )
);

CREATE POLICY "Team members with comp_tickets perm can create comp tickets"
ON public.comp_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.team_invitations ti
    WHERE ti.event_id = comp_tickets.event_id
      AND ti.accepted_by = auth.uid()
      AND ti.status = 'accepted'
      AND ti.permissions @> '["view_send_comp_tickets"]'::jsonb
  )
);

CREATE POLICY "Team members with comp_tickets perm can delete comp tickets"
ON public.comp_tickets
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_invitations ti
    WHERE ti.event_id = comp_tickets.event_id
      AND ti.accepted_by = auth.uid()
      AND ti.status = 'accepted'
      AND ti.permissions @> '["view_send_comp_tickets"]'::jsonb
  )
);
