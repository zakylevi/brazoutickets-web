-- Fix 1: Restrict organization_members SELECT to authenticated users who are members of the org
DROP POLICY IF EXISTS "Members are viewable by everyone" ON public.organization_members;
CREATE POLICY "Members viewable by org members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Fix 2: Restrict promo_codes SELECT to owner/admin only
DROP POLICY IF EXISTS "Promo codes viewable by org members" ON public.promo_codes;
CREATE POLICY "Promo codes viewable by org admins" ON public.promo_codes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN organization_members om ON om.organization_id = e.organization_id
      WHERE e.id = promo_codes.event_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Fix 3: Restrict self-joining - remove open policy, only allow org creators and owners to add members
DROP POLICY IF EXISTS "Users can join as members" ON public.organization_members;

CREATE POLICY "Creators can add themselves as owner" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_members.organization_id
        AND o.created_by = auth.uid()
    )
  );

CREATE POLICY "Owners can add members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );