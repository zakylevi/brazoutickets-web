
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== USER ROLES ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- ========== ORGANIZATIONS ==========
CREATE TYPE public.org_type AS ENUM ('venue', 'event_organizer', 'person', 'community');

CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  type org_type NOT NULL DEFAULT 'event_organizer',
  region TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  socials JSONB NOT NULL DEFAULT '{}',
  links JSONB NOT NULL DEFAULT '[]',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizations are viewable by everyone" ON public.organizations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update their organizations" ON public.organizations FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete their organizations" ON public.organizations FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== ORGANIZATION MEMBERS ==========
CREATE TYPE public.org_member_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members are viewable by everyone" ON public.organization_members FOR SELECT USING (true);
CREATE POLICY "Users can join as members" ON public.organization_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Org owners can update members" ON public.organization_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
  )
);
CREATE POLICY "Org owners or self can delete members" ON public.organization_members FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
  )
  OR auth.uid() = user_id
);

-- ========== EVENTS ==========
CREATE TYPE public.event_status AS ENUM ('draft', 'live', 'sold_out', 'cancelled');

CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  flyer_url TEXT,
  date DATE,
  time TEXT,
  doors TEXT,
  venue TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  age_restriction TEXT NOT NULL DEFAULT '18+',
  price TEXT NOT NULL DEFAULT '',
  status event_status NOT NULL DEFAULT 'draft',
  lineup JSONB NOT NULL DEFAULT '[]',
  tickets JSONB NOT NULL DEFAULT '[{"name":"Standard","price":"","perks":["General admission"],"available":true}]',
  gallery JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone" ON public.events FOR SELECT USING (true);
CREATE POLICY "Org members can create events" ON public.events FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = events.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Org members can update events" ON public.events FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = events.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Org members can delete events" ON public.events FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = events.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  )
);

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_events_organization_id ON public.events(organization_id);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_date ON public.events(date);
CREATE INDEX idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX idx_organization_members_org ON public.organization_members(organization_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
