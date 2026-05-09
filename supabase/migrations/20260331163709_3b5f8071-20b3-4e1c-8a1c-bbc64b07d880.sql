
CREATE TABLE public.organization_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_followers ENABLE ROW LEVEL SECURITY;

-- Anyone can see follower counts
CREATE POLICY "Anyone can view followers"
  ON public.organization_followers
  FOR SELECT
  TO public
  USING (true);

-- Authenticated users can follow
CREATE POLICY "Users can follow organizations"
  ON public.organization_followers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow organizations"
  ON public.organization_followers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
