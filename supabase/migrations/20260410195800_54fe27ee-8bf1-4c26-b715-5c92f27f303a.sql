
-- Add order_group_id to group multi-ticket checkouts
ALTER TABLE public.orders
ADD COLUMN order_group_id uuid NOT NULL DEFAULT gen_random_uuid();

-- Backfill: each existing order is its own group
UPDATE public.orders SET order_group_id = id;

-- Index for fast grouping queries
CREATE INDEX idx_orders_order_group_id ON public.orders (order_group_id);
