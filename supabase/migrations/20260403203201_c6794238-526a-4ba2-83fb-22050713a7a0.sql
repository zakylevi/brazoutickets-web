
-- Allow promoters (accepted team invitations) to view their own tracking links
CREATE POLICY "Promoters can view own tracking links"
ON public.tracking_links
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Allow promoters to create tracking links for events they're invited to
CREATE POLICY "Promoters can create own tracking links"
ON public.tracking_links
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.team_invitations ti
    WHERE ti.event_id = tracking_links.event_id
      AND ti.accepted_by = auth.uid()
      AND ti.status = 'accepted'
  )
);

-- Allow promoters to delete their own tracking links
CREATE POLICY "Promoters can delete own tracking links"
ON public.tracking_links
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.team_invitations ti
    WHERE ti.event_id = tracking_links.event_id
      AND ti.accepted_by = auth.uid()
      AND ti.status = 'accepted'
  )
);
