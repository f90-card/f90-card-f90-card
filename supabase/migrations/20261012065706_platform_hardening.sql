BEGIN;
REVOKE SELECT ON public.f90_orders FROM authenticated;
GRANT SELECT(id,order_number,user_id,product_id,product_name,product_image,quantity,unit_quantity,subtotal_usd,discount_usd,total_usd,refunded_usd,vip_level,coupon_code,customer_fields,fulfillment,status,expected_minutes,created_at,started_at,completed_at,updated_at) ON public.f90_orders TO authenticated;
CREATE OR REPLACE FUNCTION f90_private.my_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT r.role FROM public.f90_user_roles r JOIN public.profiles p ON p.id=r.user_id
 WHERE r.user_id=(SELECT auth.uid()) AND p.account_status='active'
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=r.user_id AND s.id=((SELECT auth.jwt())->>'session_id')::uuid AND (s.not_after IS NULL OR s.not_after>now()))
 AND (((SELECT auth.jwt())->>'aal')='aal2' OR NOT EXISTS(SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=r.user_id AND f.status='verified'));
$$;
CREATE OR REPLACE FUNCTION f90_private.catalog_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT (SELECT f90_private.my_role())='manager'; $$;
CREATE OR REPLACE FUNCTION public.f90_quote(p_user uuid,p_product uuid,p_quantity bigint DEFAULT 1,p_coupon text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.products%ROWTYPE; c jsonb; v smallint:=1; r text; spent numeric:=0; unit bigint; qty bigint; minq bigint; maxq bigint; stepq bigint;
 rate numeric; price numeric; subtotal numeric; discount numeric:=0; pct numeric:=0; vip_pct numeric:=0; cp jsonb; tier jsonb; cost numeric; trader_price numeric; cfg jsonb; co text:=NULL;valid_coupon boolean:=false;
BEGIN
 SELECT * INTO p FROM public.products WHERE id=p_product AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
 c:=p.commerce;
 IF coalesce(c->>'availability','available')='refilling' OR p.stock=0 THEN RAISE EXCEPTION 'F90_REFILLING'; END IF;
 IF EXISTS(WITH RECURSIVE parents AS (SELECT id,parent_id,is_active,presentation FROM public.categories WHERE id=p.category_id UNION SELECT a.id,a.parent_id,a.is_active,a.presentation FROM public.categories a JOIN parents b ON a.id=b.parent_id) SELECT 1 FROM parents WHERE NOT is_active OR presentation->>'availability'='refilling') THEN RAISE EXCEPTION 'F90_REFILLING'; END IF;
 IF p_user IS NOT NULL THEN
  r:=f90_private.require_actor(p_user);
  SELECT coalesce(sum(total_usd-refunded_usd),0) INTO spent FROM public.f90_orders WHERE user_id=p_user AND status IN ('completed','partial');
  SELECT level INTO v FROM public.f90_vip_tiers WHERE minimum_spend<=spent ORDER BY level DESC LIMIT 1;
  SELECT coalesce(vip_override,v,1) INTO v FROM public.profiles WHERE id=p_user;
  SELECT discount_percent INTO vip_pct FROM public.f90_vip_tiers WHERE level=v;
 END IF;
 unit:=greatest(coalesce((c->>'unit_quantity')::bigint,1),1);
 IF coalesce(c->>'type','fixed')='quantity' THEN
  minq:=greatest(coalesce((c->>'quantity_min')::bigint,1),1); maxq:=least(coalesce((c->>'quantity_max')::bigint,1000000000),1000000000); stepq:=greatest(coalesce((c->>'quantity_step')::bigint,1),1);qty:=p_quantity;
  IF qty<minq OR qty>maxq OR mod(qty-minq,stepq)<>0 THEN RAISE EXCEPTION 'F90_QUANTITY'; END IF;
 ELSE qty:=greatest(coalesce((c->>'pack_quantity')::bigint,1),1); END IF;
 price:=nullif(c#>>'{prices,USD}','')::numeric;
 IF price IS NULL THEN
  IF p.currency='USD' THEN price:=p.price; ELSE
  SELECT per_usd INTO rate FROM public.f90_rates WHERE currency=p.currency AND is_enabled;
  IF rate IS NULL THEN RAISE EXCEPTION 'F90_RATE_MISSING'; END IF;price:=p.price/rate;END IF;
 END IF;
 FOR tier IN SELECT value FROM jsonb_array_elements(coalesce(c->'pricing_tiers','[]')) ORDER BY (value->>'min')::numeric LOOP
  IF qty>=coalesce((tier->>'min')::bigint,0) AND nullif(tier#>>'{prices,USD}','') IS NOT NULL THEN price:=(tier#>>'{prices,USD}')::numeric; END IF;
 END LOOP;
 SELECT i.cost_usd,i.trader_price_usd INTO cost,trader_price FROM public.f90_product_internal i WHERE product_id=p.id;
 IF r='trader' AND trader_price IS NOT NULL THEN price:=trader_price;vip_pct:=0; END IF;
 subtotal:=round(price*CASE WHEN c->>'type'='quantity' THEN qty::numeric/unit ELSE 1 END,6);
 IF subtotal<=0 THEN RAISE EXCEPTION 'F90_PRICE_MISSING'; END IF;
 discount:=round(subtotal*coalesce(vip_pct,0)/100,6);
 SELECT config INTO cfg FROM public.site_settings WHERE id=1;
 FOR cp IN SELECT value FROM jsonb_array_elements(coalesce(cfg->'coupons','[]')) LOOP
  IF upper(trim(p_coupon))=upper(cp->>'code') AND coalesce((cp->>'enabled')::boolean,false)
   AND (nullif(cp->>'starts_at','') IS NULL OR (cp->>'starts_at')::timestamptz<=now())
   AND (nullif(cp->>'ends_at','') IS NULL OR (cp->>'ends_at')::timestamptz>now())
   AND (jsonb_array_length(coalesce(cp->'product_ids','[]'))=0 OR (cp->'product_ids') ? p.id::text)
   AND subtotal>=coalesce(nullif(cp#>>'{minimum,USD}','')::numeric,0) THEN
   valid_coupon:=true;pct:=least(greatest(coalesce((cp->>'percent')::numeric,0),0),99);
   IF cp->>'type'='percent' THEN price:=round(subtotal*pct/100,6); ELSE price:=least(coalesce(nullif(cp#>>'{prices,USD}','')::numeric,0),subtotal-0.000001); END IF;
   IF price>discount THEN discount:=price;co:=upper(cp->>'code'); END IF;
  END IF;
 END LOOP;
 IF nullif(trim(p_coupon),'') IS NOT NULL AND NOT valid_coupon THEN RAISE EXCEPTION 'F90_COUPON'; END IF;
 RETURN jsonb_build_object('product_id',p.id,'quantity',qty,'unit_quantity',unit,'subtotal_usd',subtotal,'discount_usd',discount,'total_usd',greatest(subtotal-discount,0.000001),'vip_level',v,'coupon_code',co,'spent_usd',spent);
END; $$;
CREATE OR REPLACE FUNCTION public.f90_order_transition(p_actor uuid,p_id uuid,p_status text,p_note text DEFAULT '',p_refund numeric DEFAULT NULL,p_external text DEFAULT NULL,p_cost numeric DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.f90_orders%ROWTYPE;bal numeric;refund numeric:=0;
BEGIN
 IF p_actor IS NOT NULL THEN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager','admin']);
 IF p_cost IS NOT NULL AND f90_private.require_actor(p_actor)<>'manager' THEN RAISE EXCEPTION 'F90_FORBIDDEN'; END IF;
 END IF;
 SELECT * INTO o FROM public.f90_orders WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
 IF p_status NOT IN ('processing','completed','partial','failed','review','refunded') THEN RAISE EXCEPTION 'F90_STATUS'; END IF;
 IF o.status IN ('failed','refunded') THEN RETURN to_jsonb(o); END IF;
 IF o.status IN ('completed','partial') AND p_status NOT IN ('refunded') THEN RETURN to_jsonb(o); END IF;
 IF p_status='refunded' AND p_actor IS NOT NULL AND f90_private.require_actor(p_actor) <> 'manager' AND o.status IN ('completed','partial') THEN RAISE EXCEPTION 'F90_FORBIDDEN'; END IF;
 IF o.status='review' AND p_actor IS NULL AND p_status IN ('failed','refunded') THEN RAISE EXCEPTION 'F90_RECONCILE'; END IF;
 IF p_status IN ('failed','refunded') THEN refund:=o.total_usd-o.refunded_usd;
 ELSIF p_status='partial' THEN refund:=least(greatest(coalesce(p_refund,0),0),o.total_usd-o.refunded_usd); END IF;
 IF refund>0 THEN
  SELECT balance_usd INTO bal FROM public.f90_wallets WHERE user_id=o.user_id FOR UPDATE;
  UPDATE public.f90_wallets SET balance_usd=bal+refund,updated_at=now() WHERE user_id=o.user_id;
  INSERT INTO public.f90_wallet_ledger(user_id,amount_usd,balance_after,kind,reference_id,description,unique_key,actor_id)
  VALUES(o.user_id,refund,bal+refund,'refund',o.id,'استرداد: '||o.product_name,'refund:'||o.id||':'||(o.refunded_usd+refund)::text,p_actor);
 END IF;
 IF p_status IN ('failed','refunded') AND o.stock_reserved AND o.product_id IS NOT NULL THEN
  UPDATE public.products SET stock=stock+1 WHERE id=o.product_id AND stock IS NOT NULL;
 END IF;
 UPDATE public.f90_orders SET status=p_status,refunded_usd=refunded_usd+refund,stock_reserved=CASE WHEN p_status IN ('failed','refunded') THEN false ELSE stock_reserved END,
  provider_order_id=coalesce(p_external,provider_order_id),cost_usd=coalesce(p_cost,cost_usd),started_at=coalesce(started_at,now()),
  completed_at=CASE WHEN p_status IN ('completed','partial','failed','refunded') THEN now() ELSE completed_at END,
  next_sync_at=now()+interval '1 minute',updated_at=now() WHERE id=o.id RETURNING * INTO o;
 INSERT INTO public.f90_order_events(order_id,status,note) VALUES(o.id,p_status,left(p_note,2000));
 INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,'order.'||p_status,o.id::text,jsonb_build_object('refund_usd',refund));
 RETURN to_jsonb(o);
END; $$;
CREATE OR REPLACE FUNCTION public.f90_claim_work() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE rows jsonb;
BEGIN
 -- Never redispatch an ambiguous network result. Staff must reconcile it first.
 UPDATE public.f90_orders SET status='review',updated_at=now() WHERE status='submitting' AND updated_at<now()-interval '5 minutes';
 WITH work AS (SELECT id FROM public.f90_orders WHERE fulfillment='automatic' AND status IN ('queued','processing') AND next_sync_at<=now() ORDER BY next_sync_at FOR UPDATE SKIP LOCKED LIMIT 3),
 claimed AS (UPDATE public.f90_orders o SET status=CASE WHEN o.status='queued' THEN 'submitting' ELSE o.status END,
 dispatch_attempts=o.dispatch_attempts+CASE WHEN o.status='queued' THEN 1 ELSE 0 END,started_at=coalesce(o.started_at,now()),next_sync_at=now()+interval '2 minutes',updated_at=now() FROM work w WHERE o.id=w.id RETURNING o.*)
 SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') INTO rows FROM claimed c;
 RETURN rows;
END; $$;
COMMIT;
