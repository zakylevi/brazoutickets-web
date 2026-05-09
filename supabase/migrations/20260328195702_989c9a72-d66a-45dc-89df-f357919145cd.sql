
DROP POLICY "Anyone can validate promo codes" ON public.promo_codes;

CREATE POLICY "Anyone can validate promo codes"
ON public.promo_codes
FOR SELECT
TO anon, authenticated
USING (true);
