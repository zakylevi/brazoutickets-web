CREATE POLICY "Buyers can mark available seats as sold"
ON public.seats
FOR UPDATE
TO authenticated
USING (status = 'available' AND blocked = false)
WITH CHECK (status = 'sold' AND order_id IS NOT NULL);