CREATE TABLE public.promoted_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  background_url TEXT,
  event_link TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.promoted_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view promoted events"
  ON public.promoted_events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage promoted events"
  ON public.promoted_events FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));