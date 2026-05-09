ALTER TABLE public.promoted_events ADD COLUMN placement text NOT NULL DEFAULT 'homepage';

-- Update existing rows to be homepage
UPDATE public.promoted_events SET placement = 'homepage' WHERE placement = 'homepage';