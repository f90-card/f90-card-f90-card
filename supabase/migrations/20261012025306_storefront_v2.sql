-- F90 CARD v2: additive catalog and storefront configuration migration.
-- Run in the EXISTING Supabase project. No order, profile or role data is removed.
BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS commerce jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS presentation jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS presentation jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.products.commerce IS
  'Fixed or quantity pricing; USD/JOD/ILS prices; tiers; customer fields; bilingual descriptions and delivery.';
COMMENT ON COLUMN public.categories.presentation IS
  'Bilingual category metadata; replaceable category banner; popular-service flag.';
COMMENT ON COLUMN public.banners.presentation IS
  'Bilingual captions, optional overlay, scheduling and slide duration.';
COMMENT ON COLUMN public.site_settings.config IS
  'Public storefront configuration only. Never store credentials or personal customer data here.';

-- The internal role lookup is outside the exposed API schema.
CREATE SCHEMA IF NOT EXISTS f90_private;
REVOKE ALL ON SCHEMA f90_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA f90_private TO authenticated, service_role;

-- This helper checks only the signed-in caller's admin role.
CREATE OR REPLACE FUNCTION f90_private.catalog_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
  );
$function$;
REVOKE ALL ON FUNCTION f90_private.catalog_is_admin() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION f90_private.catalog_is_admin() TO authenticated, service_role;

-- Preserve the existing policy entry point as a non-privileged wrapper.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT f90_private.catalog_is_admin();
$function$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Legacy admin policies were applicable to anon and called a function anon
-- cannot execute. Limit those policies to signed-in sessions. Public read
-- policies below do not call an admin function at all.
DO $migration$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('products', 'categories', 'banners', 'site_settings')
      AND (COALESCE(qual, '') ILIKE '%is_admin%'
           OR COALESCE(with_check, '') ILIKE '%is_admin%')
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', p.policyname, p.tablename);
  END LOOP;
END;
$migration$;

GRANT SELECT ON public.products, public.categories, public.banners, public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.products, public.categories, public.banners, public.site_settings TO authenticated;

DO $migration$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['products','categories','banners']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename=table_name AND policyname='F90 v2 public catalog read'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (is_active = true)',
        'F90 v2 public catalog read', table_name
      );
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='site_settings' AND policyname='F90 v2 public settings read'
  ) THEN
    CREATE POLICY "F90 v2 public settings read"
    ON public.site_settings FOR SELECT TO anon, authenticated USING (id = 1);
  END IF;
  FOREACH table_name IN ARRAY ARRAY['products','categories','banners','site_settings']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename=table_name AND policyname='F90 v2 admin catalog manage'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT f90_private.catalog_is_admin())) WITH CHECK ((SELECT f90_private.catalog_is_admin()))',
        'F90 v2 admin catalog manage', table_name
      );
    END IF;
  END LOOP;
END;
$migration$;

-- Existing branding and settings are retained; only the new config version and
-- requested USD default are initialized on the first run.
UPDATE public.site_settings
SET config = jsonb_set(config, '{version}', '2'::jsonb, true),
    currency = 'USD', updated_at = now()
WHERE id = 1 AND config->>'version' IS DISTINCT FROM '2';

-- Respect an existing bucket's settings. These defaults apply only if missing.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('f90-images', 'f90-images', true, 5242880,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage'
    AND tablename='objects' AND policyname='F90 v2 admins upload images') THEN
    CREATE POLICY "F90 v2 admins upload images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id='f90-images' AND (SELECT f90_private.catalog_is_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage'
    AND tablename='objects' AND policyname='F90 v2 admins update images') THEN
    CREATE POLICY "F90 v2 admins update images" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id='f90-images' AND (SELECT f90_private.catalog_is_admin()))
    WITH CHECK (bucket_id='f90-images' AND (SELECT f90_private.catalog_is_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage'
    AND tablename='objects' AND policyname='F90 v2 admins delete images') THEN
    CREATE POLICY "F90 v2 admins delete images" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id='f90-images' AND (SELECT f90_private.catalog_is_admin()));
  END IF;
END;
$migration$;

CREATE INDEX IF NOT EXISTS f90_products_active_sort_idx
  ON public.products (sort_order, created_at DESC, id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS f90_categories_active_sort_idx
  ON public.categories (sort_order, id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS f90_banners_active_sort_idx
  ON public.banners (sort_order, id) WHERE is_active = true;

NOTIFY pgrst, 'reload schema';
COMMIT;
