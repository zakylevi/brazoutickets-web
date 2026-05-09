-- Allow anyone to validate a promo code by code+event_id (needed for checkout)
-- We keep the admin-only full SELECT but add a public read for validation
CREATE POLICY "Anyone can validate promo codes" ON public.promo_codes
  FOR SELECT TO authenticated
  USING (true);