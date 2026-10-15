-- Display rate basis: reference mid-market 15 October 2026; managers own subsequent updates.
-- ILS=3.35 is a STORE-CHOSEN price distinct from supplier 3.20 and global spot.
INSERT INTO public.f90_rates(currency,name_ar,per_usd,is_enabled)
VALUES
('EUR','يورو',0.8919,true),
('AED','درهم إماراتي',3.6725,true),
('SAR','ريال سعودي',3.75,true),
('QAR','ريال قطري',3.64,true),
('KWD','دينار كويتي',0.3109,true),
('BHD','دينار بحريني',0.377,true),
('OMR','ريال عُماني',0.3845,true),
('EGP','جنيه مصري',53.434,true),
('IQD','دينار عراقي',1514,true),
('YER','ريال يمني',236.175,true),
('LBP','ليرة لبنانية',89498,true),
('SYP','ليرة سورية',13002,true),
('DZD','دينار جزائري',134.428,true),
('TND','دينار تونسي',3.002,true),
('LYD','دينار ليبي',6.421,true),
('MAD','درهم مغربي',9.796,true),
('SDG','جنيه سوداني',601.5,true),
('MRU','أوقية موريتانية',40.052,true),
('SOS','شلن صومالي',571.283,true),
('DJF','فرنك جيبوتي',178.75,true),
('TRY','ليرة تركية',49.418,true),
('GBP','جنيه إسترليني',0.7534,true),
('IRR','ريال إيراني',1374600,true),
('AFN','أفغاني',65,true)
ON CONFLICT(currency) DO NOTHING;
UPDATE public.f90_rates SET per_usd=3.35,is_enabled=true WHERE currency='ILS';
UPDATE public.site_settings SET config=config||jsonb_build_object('default_display_currency','ILS','fx_rates_reference','2026-10-15 manually editable') WHERE id=1;

CREATE OR REPLACE FUNCTION f90_private.category_extra_margin(p_category uuid)
RETURNS numeric LANGUAGE sql STABLE SET search_path='' AS $$
 WITH RECURSIVE lineage AS (
   SELECT id,parent_id,presentation FROM public.categories WHERE id=p_category
   UNION ALL
   SELECT c.id,c.parent_id,c.presentation FROM public.categories c JOIN lineage l ON c.id=l.parent_id
 )
 SELECT coalesce(sum(coalesce((presentation->>'extra_margin_percent')::numeric,0)),0) FROM lineage;
$$;
REVOKE ALL ON FUNCTION f90_private.category_extra_margin(uuid) FROM PUBLIC,anon,authenticated;

-- Only the store manager is allowed to assign add-on margins and reprice affected auto-managed products.
CREATE OR REPLACE FUNCTION public.f90_manager_extra_margin(p_kind text,p_id uuid,p_percent numeric)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE total integer:=0;
BEGIN
 PERFORM f90_private.require_actor(auth.uid(),ARRAY['manager']);
 IF p_percent IS NULL OR p_percent<0 OR p_percent>100 OR p_kind NOT IN ('category','product')
 THEN RAISE EXCEPTION 'F90_INVALID_MARGIN'; END IF;
 IF p_kind='category' THEN
   UPDATE public.categories SET presentation=jsonb_set(coalesce(presentation,'{}'::jsonb),
      '{extra_margin_percent}',to_jsonb(p_percent),true)
   WHERE id=p_id;
 ELSE
   UPDATE public.products SET commerce=jsonb_set(coalesce(commerce,'{}'::jsonb),
      '{extra_margin_percent}',to_jsonb(p_percent),true)
   WHERE id=p_id;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
 UPDATE public.products product SET
   price=round(i.cost_usd*(1+(p.margin_percent+
      f90_private.category_extra_margin(product.category_id)+
      coalesce((product.commerce->>'extra_margin_percent')::numeric,0))/100),2),
   commerce=jsonb_set(product.commerce,'{prices,USD}',
      to_jsonb(round(i.cost_usd*(1+(p.margin_percent+
       f90_private.category_extra_margin(product.category_id)+
       coalesce((product.commerce->>'extra_margin_percent')::numeric,0))/100),6)),true)
 FROM public.f90_product_internal i JOIN public.f90_providers p ON p.id=i.provider_id
 WHERE i.product_id=product.id AND i.auto_margin AND i.cost_usd>0
   AND (p_kind='product' AND product.id=p_id OR p_kind='category' AND EXISTS(
      WITH RECURSIVE nested AS(
        SELECT id,parent_id FROM public.categories WHERE id=product.category_id
        UNION ALL SELECT c.id,c.parent_id FROM public.categories c JOIN nested n ON c.id=n.parent_id
      ) SELECT 1 FROM nested WHERE id=p_id
   ))
   AND i.cost_usd*(1+(p.margin_percent+
      f90_private.category_extra_margin(product.category_id)+
      coalesce((product.commerce->>'extra_margin_percent')::numeric,0))/100) BETWEEN 0.000001 AND 1000000;
 GET DIAGNOSTICS total=ROW_COUNT;
 INSERT INTO public.f90_audit(actor_id,action,target_id,details)
 VALUES(auth.uid(),'pricing.extra_margin',p_id::text,jsonb_build_object('type',p_kind,'percent',p_percent,'repriced',total));
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.f90_manager_extra_margin(text,uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f90_manager_extra_margin(text,uuid,numeric) TO authenticated;

-- Supplier ILS/$ and supplier's own additional commission; unrelated to customer display FX.
CREATE OR REPLACE FUNCTION public.f90_manager_supplier_pricing(
 p_provider uuid,p_fx numeric,p_commission numeric,p_margin numeric
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE oldrate numeric;oldcommission numeric;affected integer:=0;
BEGIN
 PERFORM f90_private.require_actor(auth.uid(),ARRAY['manager']);
 IF p_fx<=0 OR p_fx>1000 OR p_commission<0 OR p_commission>50 OR p_margin<0 OR p_margin>100
 THEN RAISE EXCEPTION 'F90_INVALID_PRICING'; END IF;
 SELECT coalesce((config->>'supplier_ils_per_usd')::numeric,3.20),
   coalesce((config->>'supplier_commission_percent')::numeric,0)
 INTO oldrate,oldcommission FROM public.f90_providers
 WHERE id=p_provider AND adapter='yassen' AND currency='ILS'
   AND config->>'archived_at' IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_PROVIDER_NOT_FOUND';END IF;
 UPDATE public.f90_product_internal i SET
   cost_usd=round(cost_usd*oldrate/p_fx*(1+p_commission/100)/(1+oldcommission/100),6)
 WHERE provider_id=p_provider AND cost_usd>0;
 UPDATE public.f90_providers SET
   margin_percent=p_margin,
   config=config||jsonb_build_object('supplier_ils_per_usd',p_fx,'supplier_commission_percent',p_commission)
 WHERE id=p_provider;
 UPDATE public.products product SET price=round(i.cost_usd*(1+(p_margin+
     f90_private.category_extra_margin(product.category_id)+
     coalesce((product.commerce->>'extra_margin_percent')::numeric,0))/100),2),
   commerce=jsonb_set(product.commerce,'{prices,USD}',
    to_jsonb(round(i.cost_usd*(1+(p_margin+
      f90_private.category_extra_margin(product.category_id)+
      coalesce((product.commerce->>'extra_margin_percent')::numeric,0))/100),6)),true)
 FROM public.f90_product_internal i WHERE i.product_id=product.id
  AND i.provider_id=p_provider AND i.auto_margin AND i.cost_usd>0
  AND i.cost_usd*(1+(p_margin+f90_private.category_extra_margin(product.category_id)+
    coalesce((product.commerce->>'extra_margin_percent')::numeric,0))/100) BETWEEN 0.000001 AND 1000000;
 GET DIAGNOSTICS affected=ROW_COUNT;
 INSERT INTO public.f90_audit(actor_id,action,target_id,details)
 VALUES(auth.uid(),'pricing.supplier_rates',p_provider::text,jsonb_build_object('supplier_ils_per_usd',p_fx,'supplier_commission',p_commission,'profit_margin',p_margin,'repriced',affected));
 RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.f90_manager_supplier_pricing(uuid,numeric,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f90_manager_supplier_pricing(uuid,numeric,numeric,numeric) TO authenticated;

-- Future manual provider margin edits keep service/category additional margin.
CREATE OR REPLACE FUNCTION public.f90_provider_margin(p_actor uuid,p_provider uuid,p_margin numeric)
RETURNS integer LANGUAGE plpgsql SET search_path='' AS $$
DECLARE affected integer;
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager']);
 IF p_margin IS NULL OR p_margin<0 OR p_margin>100 THEN RAISE EXCEPTION 'F90_FIELDS';END IF;
 UPDATE public.products product SET
 price=round(i.cost_usd*(1+(p_margin+f90_private.category_extra_margin(product.category_id)+
   coalesce((product.commerce->>'extra_margin_percent')::numeric,0))/100),2),
 commerce=jsonb_set(product.commerce,'{prices,USD}',
  to_jsonb(round(i.cost_usd*(1+(p_margin+f90_private.category_extra_margin(product.category_id)+
   coalesce((product.commerce->>'extra_margin_percent')::numeric,0))/100),6)),true)
 FROM public.f90_product_internal i WHERE i.product_id=product.id AND i.provider_id=p_provider
 AND i.auto_margin AND i.cost_usd>0
 AND i.cost_usd*(1+(p_margin+f90_private.category_extra_margin(product.category_id)+
   coalesce((product.commerce->>'extra_margin_percent')::numeric,0))/100) BETWEEN 0.000001 AND 1000000;
 GET DIAGNOSTICS affected=ROW_COUNT;
 UPDATE public.f90_providers SET margin_percent=p_margin WHERE id=p_provider;
 INSERT INTO public.f90_audit(actor_id,action,target_id,details)
 VALUES(p_actor,'provider.margin',p_provider::text,jsonb_build_object('margin_percent',p_margin,'updated',affected));
 RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.f90_provider_margin(uuid,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_provider_margin(uuid,uuid,numeric) TO service_role;
