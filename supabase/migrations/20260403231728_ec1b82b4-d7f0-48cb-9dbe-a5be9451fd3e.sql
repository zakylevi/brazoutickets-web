
CREATE POLICY "Team members with edit permissions can update events"
ON public.events
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_invitations ti
    WHERE ti.event_id = events.id
      AND ti.accepted_by = auth.uid()
      AND ti.status = 'accepted'
      AND (
        ti.permissions::jsonb ? 'edit_event_visuals'
        OR ti.permissions::jsonb ? 'edit_event_settings'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.team_invitations ti
    WHERE ti.event_id = events.id
      AND ti.accepted_by = auth.uid()
      AND ti.status = 'accepted'
      AND (
        ti.permissions::jsonb ? 'edit_event_visuals'
        OR ti.permissions::jsonb ? 'edit_event_settings'
      )
  )
);
