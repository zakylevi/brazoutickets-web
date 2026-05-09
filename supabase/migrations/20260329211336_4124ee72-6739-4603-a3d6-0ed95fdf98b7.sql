
-- Create blocked_users table for org-level user blocking
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  blocked_by uuid NOT NULL,
  reason text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Org members can view blocked users for their org
CREATE POLICY "Org members can view blocked users"
ON public.blocked_users FOR SELECT TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
);

-- Org owners/admins can block users
CREATE POLICY "Org owners can block users"
ON public.blocked_users FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = blocked_users.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  )
);

-- Org owners/admins can unblock users
CREATE POLICY "Org owners can unblock users"
ON public.blocked_users FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = blocked_users.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  )
);

-- Security definer function to check if a user is blocked by an org
CREATE OR REPLACE FUNCTION public.is_user_blocked_by_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;
