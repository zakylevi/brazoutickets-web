
INSERT INTO storage.buckets (id, name, public) VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view event images" ON storage.objects FOR SELECT USING (bucket_id = 'event-images');
CREATE POLICY "Authenticated users can upload event images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-images' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete own event images" ON storage.objects FOR DELETE USING (bucket_id = 'event-images' AND auth.role() = 'authenticated');
