CREATE OR REPLACE FUNCTION public.f90_quote_currency(p_user uuid, p_product uuid, p_quantity bigint DEFAULT 1, p_coupon text DEFAULT ''::text, p_currency text DEFAULT 'USD'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE p public.products%ROWTYPE; c jsonb; v smallint:=1; r text; spent numeric:=0; unit bigint; qty bigint; minq bigint; maxq bigint; stepq bigint;
 rate numeric; price numeric; subtotal numeric; discount numeric:=0; pct numeric:=0; vip_pct numeric:=0; cp jsonb; tier jsonb; cost numeric; trader_price numeric; cfg jsonb; co text:=NULL;valid_coupon boolean:=false;
currency_code text; currency_rate numeric:=1; fixed_price numeric; fixed_unit bigint; fixed_enabled boolean:=false; native_subtotal numeric; markup numeric:=0;
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
  IF qty>=coalesce((tier->>'min')::bigint,0) AND (nullif(tier->>'max','') IS NULL OR qty<=(tier->>'max')::bigint) AND nullif(tier#>>'{prices,USD}','') IS NOT NULL THEN price:=(tier#>>'{prices,USD}')::numeric; END IF;
 END LOOP;
 SELECT i.cost_usd,i.trader_price_usd INTO cost,trader_price FROM public.f90_product_internal i WHERE product_id=p.id;
 IF r='trader' AND trader_price IS NOT NULL THEN price:=trader_price;vip_pct:=0; END IF;
 subtotal:=round(price*CASE WHEN c->>'type'='quantity' THEN qty::numeric/unit ELSE 1 END,6);
 SELECT config INTO cfg FROM public.site_settings WHERE id=1;
 currency_code:=upper(coalesce(nullif(p_currency,''),'USD'));
 IF p_user IS NOT NULL THEN SELECT coalesce(account_currency,'USD') INTO currency_code FROM public.profiles WHERE id=p_user; END IF;
 SELECT per_usd INTO currency_rate FROM public.f90_rates WHERE currency=currency_code AND is_enabled AND NOT is_archived;
 IF currency_rate IS NULL OR currency_rate<=0 THEN RAISE EXCEPTION 'F90_RATE_MISSING'; END IF;
 IF coalesce((cfg->>'currency_pricing_enabled')::boolean,true) AND coalesce((c#>>'{currency_pricing,enabled}')::boolean,false) THEN
  fixed_price:=nullif(c#>>ARRAY['currency_pricing','prices',currency_code],'')::numeric;
  IF fixed_price IS NOT NULL THEN
   fixed_unit:=nullif(c#>>'{currency_pricing,unit_quantity}','')::bigint;
   IF fixed_price<=0 OR fixed_price>1000000000 OR fixed_unit IS NULL OR fixed_unit<1 OR fixed_unit>1000000000 THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
   native_subtotal:=round(fixed_price*qty::numeric/fixed_unit,6);
   subtotal:=round(native_subtotal/currency_rate,6); fixed_enabled:=true;
  END IF;
 END IF;
 SELECT CASE WHEN purchase_markup_enabled THEN purchase_markup_percent ELSE 0 END INTO markup FROM public.f90_user_discounts WHERE user_id=p_user;
 markup:=coalesce(markup,0);
 IF markup<>0 THEN
  IF fixed_enabled THEN native_subtotal:=round(native_subtotal*(1+markup/100),6);subtotal:=round(native_subtotal/currency_rate,6);
  ELSE subtotal:=round(subtotal*(1+markup/100),6); END IF;
 END IF;
 IF NOT fixed_enabled THEN native_subtotal:=round(subtotal*currency_rate,6); END IF;
 IF subtotal IS NULL OR subtotal<=0 THEN RAISE EXCEPTION 'F90_PRICE_MISSING'; END IF;
 discount:=round(subtotal*least(coalesce(vip_pct,0)+coalesce((SELECT extra_discount_percent FROM public.f90_user_discounts WHERE user_id=p_user),0),95)/100,6);
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
 RETURN jsonb_build_object('product_id',p.id,'quantity',qty,'unit_quantity',unit,'subtotal_usd',subtotal,'discount_usd',discount,'total_usd',greatest(subtotal-discount,0.000001),'vip_level',v,'coupon_code',co,'spent_usd',spent,'extra_discount_percent',coalesce((SELECT extra_discount_percent FROM public.f90_user_discounts WHERE user_id=p_user),0),'price_currency',currency_code,'pricing_exchange_rate',currency_rate,'subtotal_currency',native_subtotal,'discount_currency',round(discount*currency_rate,6),'total_currency',greatest(round(native_subtotal-discount*currency_rate,6),0.000001),'currency_price_fixed',fixed_enabled,'currency_unit_quantity',CASE WHEN fixed_enabled THEN fixed_unit ELSE unit END,'purchase_markup_percent',markup);
END; $function$
