-- Fix 1: Restrict profiles SELECT to own profile only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Fix 2: Restrict organization_members INSERT to 'member' role only
DROP POLICY IF EXISTS "Users can join as members" ON public.organization_members;
CREATE POLICY "Users can join as members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'member'::org_member_role);