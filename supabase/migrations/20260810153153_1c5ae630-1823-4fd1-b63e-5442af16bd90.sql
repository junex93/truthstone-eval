
-- Path convention enforced by policies: <organization_id>/<valuation_case_id>/<file>
CREATE POLICY "evidence_read_own_org" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'evidence-originals'
  AND EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid() AND m.status = 'ACTIVE'
      AND m.organization_id::text = (storage.foldername(name))[1])
);

CREATE POLICY "evidence_insert_own_org" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidence-originals'
  AND EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid() AND m.status = 'ACTIVE'
      AND m.role IN ('OWNER','ADMIN','VALUER')
      AND m.organization_id::text = (storage.foldername(name))[1])
);

CREATE POLICY "property_media_read_own_org" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'property-media'
  AND EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid() AND m.status = 'ACTIVE'
      AND m.organization_id::text = (storage.foldername(name))[1])
);

CREATE POLICY "property_media_insert_own_org" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'property-media'
  AND EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid() AND m.status = 'ACTIVE'
      AND m.role IN ('OWNER','ADMIN','VALUER')
      AND m.organization_id::text = (storage.foldername(name))[1])
);

CREATE POLICY "reports_read_own_org" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'generated-reports'
  AND EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid() AND m.status = 'ACTIVE'
      AND m.organization_id::text = (storage.foldername(name))[1])
);

CREATE POLICY "reports_admin_manage" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'generated-reports'
  AND EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid() AND m.status = 'ACTIVE'
      AND m.role IN ('OWNER','ADMIN')
      AND m.organization_id::text = (storage.foldername(name))[1])
);
