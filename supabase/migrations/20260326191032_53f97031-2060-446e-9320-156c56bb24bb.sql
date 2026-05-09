-- Create a security definer function to check org membership (avoids infinite recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- Fix: Replace self-referencing policy with one using the security definer function
DROP POLICY IF EXISTS "Members viewable by org members" ON public.organization_members;
CREATE POLICY "Members viewable by org members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));