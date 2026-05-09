DROP POLICY IF EXISTS "Users can view own invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Users can update own invitations" ON public.team_invitations;

CREATE POLICY "Users can view own invitations"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (
  accepted_by = auth.uid()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

CREATE POLICY "Users can update own invitations"
ON public.team_invitations
FOR UPDATE
TO authenticated
USING (
  accepted_by = auth.uid()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
WITH CHECK (
  accepted_by = auth.uid()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);