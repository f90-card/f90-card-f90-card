-- F90 CARD private admin-uploaded radio media.
-- Existing public media buckets are not modified or deleted.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('f90-radio','f90-radio',false,41943040,ARRAY[
  'audio/mpeg','audio/ogg','audio/wav','audio/mp4',
  'video/mp4','video/webm']::text[])
ON CONFLICT(id) DO UPDATE SET
 public=false,file_size_limit=EXCLUDED.file_size_limit,
 allowed_mime_types=EXCLUDED.allowed_mime_types;

DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage'
   AND tablename='objects' AND policyname='f90_radio_manager_upload') THEN
  CREATE POLICY f90_radio_manager_upload ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
      bucket_id='f90-radio' AND (SELECT f90_private.catalog_is_admin()));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage'
   AND tablename='objects' AND policyname='f90_radio_manager_delete') THEN
  CREATE POLICY f90_radio_manager_delete ON storage.objects
    FOR DELETE TO authenticated USING (
      bucket_id='f90-radio' AND (SELECT f90_private.catalog_is_admin()));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage'
   AND tablename='objects' AND policyname='f90_radio_manager_select') THEN
  CREATE POLICY f90_radio_manager_select ON storage.objects
    FOR SELECT TO authenticated USING (
      bucket_id='f90-radio' AND (SELECT f90_private.catalog_is_admin()));
 END IF;
END $$;
