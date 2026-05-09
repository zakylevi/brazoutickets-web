ALTER TABLE public.ticket_types
ADD COLUMN max_per_order integer;

UPDATE public.ticket_types
SET max_per_order = 10
WHERE max_per_order IS NULL;

ALTER TABLE public.ticket_types
ALTER COLUMN max_per_order SET DEFAULT 10;

ALTER TABLE public.ticket_types
ALTER COLUMN max_per_order SET NOT NULL;

ALTER TABLE public.ticket_types
ADD CONSTRAINT ticket_types_max_per_order_positive CHECK (max_per_order >= 1);