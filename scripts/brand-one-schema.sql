ALTER TABLE public.f90_providers DROP CONSTRAINT f90_providers_adapter_check;
ALTER TABLE public.f90_providers ADD CONSTRAINT f90_providers_adapter_check CHECK(adapter IN ('smm','json','omega','rest','yassen','f90','f90_merchant','shihab','brand_one'));
CREATE TABLE f90_private.brand_categories (source_id text PRIMARY KEY, source jsonb NOT NULL, fetched boolean NOT NULL DEFAULT false, image_url text);
CREATE TABLE f90_private.brand_products (source_id text PRIMARY KEY, source jsonb NOT NULL);
ALTER TABLE f90_private.brand_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE f90_private.brand_products ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON f90_private.brand_categories,f90_private.brand_products TO service_role;
CREATE FUNCTION public.f90_brand_stage(p_products jsonb DEFAULT '[]',p_categories jsonb DEFAULT '[]',p_fetched text[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF jsonb_array_length(p_products)>0 THEN UPDATE f90_private.brand_products SET source=jsonb_set(source,'{available}','false') WHERE source_id NOT IN (SELECT e->>'id' FROM jsonb_array_elements(p_products) e); END IF;
 INSERT INTO f90_private.brand_products(source_id,source) SELECT e->>'id',e FROM jsonb_array_elements(p_products) e
 ON CONFLICT(source_id) DO UPDATE SET source=excluded.source || CASE WHEN f90_private.brand_products.source ? 'web' THEN jsonb_build_object('web',f90_private.brand_products.source->'web') ELSE '{}'::jsonb END;
 INSERT INTO f90_private.brand_categories(source_id,source) SELECT e->>'id',e FROM jsonb_array_elements(p_categories) e
 ON CONFLICT(source_id) DO UPDATE SET source=excluded.source || CASE WHEN f90_private.brand_categories.source ? 'web' THEN jsonb_build_object('web',f90_private.brand_categories.source->'web') ELSE '{}'::jsonb END;
 UPDATE f90_private.brand_categories SET fetched=true WHERE source_id=ANY(p_fetched);
 RETURN jsonb_build_object('pending',(SELECT coalesce(jsonb_agg(source_id ORDER BY source_id),'[]') FROM f90_private.brand_categories WHERE NOT fetched),'products',(SELECT count(*) FROM f90_private.brand_products),'categories',(SELECT count(*) FROM f90_private.brand_categories));
END $$;
REVOKE ALL ON FUNCTION public.f90_brand_stage(jsonb,jsonb,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_brand_stage(jsonb,jsonb,text[]) TO service_role;
CREATE FUNCTION f90_private.brand_category_access(p_category uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT f90_private.my_role()='manager'),false) OR NOT EXISTS(
 WITH RECURSIVE ancestry AS (SELECT id,parent_id,presentation FROM public.categories WHERE id=p_category UNION ALL SELECT c.id,c.parent_id,c.presentation FROM public.categories c JOIN ancestry a ON a.parent_id=c.id)
 SELECT 1 FROM ancestry a JOIN public.f90_providers p ON p.id::text=a.presentation->>'provider_id'
 WHERE p.adapter='brand_one' AND (coalesce(p.config->>'catalog_visibility','manager')<>'public' OR coalesce((p.config->>'disconnected')::boolean,false) OR p.config ? 'archived_at'));
$$;
REVOKE ALL ON FUNCTION f90_private.brand_category_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f90_private.brand_category_access(uuid) TO anon,authenticated,service_role;
CREATE POLICY brand_category_visibility ON public.categories AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(f90_private.brand_category_access(id));
CREATE POLICY brand_product_visibility ON public.products AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(f90_private.brand_category_access(category_id));
