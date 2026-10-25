-- Additive controls only. No existing service prices, balances, currency rates or supplier settings are changed.
ALTER TABLE public.f90_user_discounts ADD COLUMN purchase_markup_percent numeric(8,3) NOT NULL DEFAULT 0 CHECK(purchase_markup_percent BETWEEN 0 AND 10000), ADD COLUMN purchase_markup_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.f90_orders ADD COLUMN price_currency text, ADD COLUMN subtotal_currency numeric, ADD COLUMN discount_currency numeric, ADD COLUMN total_currency numeric, ADD COLUMN pricing_exchange_rate numeric, ADD COLUMN purchase_markup_percent numeric;

CREATE TABLE public.f90_currency_adjustments (
 request_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES auth.users(id), user_id uuid NOT NULL REFERENCES auth.users(id),
 source_amount numeric NOT NULL, source_currency text NOT NULL, exchange_rate numeric NOT NULL CHECK(exchange_rate>0), amount_usd numeric NOT NULL,
 reason text NOT NULL, ledger_id uuid NOT NULL UNIQUE REFERENCES public.f90_wallet_ledger(id), balance_after numeric NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX f90_currency_adjustments_user_recent ON public.f90_currency_adjustments(user_id,created_at DESC);
CREATE INDEX f90_currency_adjustments_actor ON public.f90_currency_adjustments(actor_id);
ALTER TABLE public.f90_currency_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.f90_currency_adjustments FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.f90_currency_adjustments TO service_role;

CREATE OR REPLACE FUNCTION public.f90_set_user_markup(p_actor uuid,p_user uuid,p_percent numeric,p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager']);
 IF p_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user) THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
 IF p_percent IS NULL OR p_percent<0 OR p_percent>10000 OR scale(p_percent)>3 OR p_enabled IS NULL THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 INSERT INTO public.f90_user_discounts(user_id,purchase_markup_percent,purchase_markup_enabled,updated_by,updated_at)
 VALUES(p_user,p_percent,p_enabled,p_actor,now()) ON CONFLICT(user_id) DO UPDATE SET purchase_markup_percent=excluded.purchase_markup_percent,purchase_markup_enabled=excluded.purchase_markup_enabled,updated_by=p_actor,updated_at=now();
 INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,'user.purchase_markup',p_user::text,jsonb_build_object('percent',p_percent,'enabled',p_enabled));
 RETURN jsonb_build_object('saved',true,'purchase_markup_percent',p_percent,'purchase_markup_enabled',p_enabled);
END $$;
REVOKE ALL ON FUNCTION public.f90_set_user_markup(uuid,uuid,numeric,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_set_user_markup(uuid,uuid,numeric,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.f90_currency_pricing_toggle(p_actor uuid,p_enabled boolean,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager']);
 IF p_enabled IS NULL OR length(btrim(coalesce(p_reason,'')))<8 OR length(p_reason)>500 THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 UPDATE public.site_settings SET config=jsonb_set(coalesce(config,'{}'),'{currency_pricing_enabled}',to_jsonb(p_enabled),true) WHERE id=1;
 INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,'pricing.currency_global','1',jsonb_build_object('enabled',p_enabled,'reason',btrim(p_reason)));
 RETURN jsonb_build_object('saved',true,'enabled',p_enabled);
END $$;
REVOKE ALL ON FUNCTION public.f90_currency_pricing_toggle(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_currency_pricing_toggle(uuid,boolean,text) TO service_role;

CREATE OR REPLACE FUNCTION public.f90_finance_adjust_currency(p_actor uuid,p_user uuid,p_amount numeric,p_currency text,p_note text,p_request uuid,p_expected numeric,p_expected_rate numeric)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE previous public.f90_currency_adjustments%ROWTYPE; fx numeric; converted numeric; result jsonb; code text:=upper(p_currency);
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager']);
 IF p_user IS NULL OR p_actor=p_user THEN RAISE EXCEPTION 'F90_FORBIDDEN'; END IF;
 IF p_amount IS NULL OR p_amount=0 OR abs(p_amount)>1000000000 OR round(p_amount,6)<>p_amount OR code NOT IN('USD','ILS','JOD') THEN RAISE EXCEPTION 'F90_AMOUNT'; END IF;
 IF p_request IS NULL OR length(btrim(coalesce(p_note,'')))<5 OR length(p_note)>500 THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('f90-currency-adjust:'||p_request::text,0));
 SELECT * INTO previous FROM public.f90_currency_adjustments WHERE request_id=p_request;
 IF FOUND THEN
  IF previous.actor_id<>p_actor OR previous.user_id<>p_user OR previous.source_amount<>p_amount OR previous.source_currency<>code OR previous.reason<>btrim(p_note) THEN RAISE EXCEPTION 'F90_IDEMPOTENCY_CONFLICT'; END IF;
  RETURN jsonb_build_object('saved',true,'replayed',true,'balance_usd',previous.balance_after,'reference_id',previous.ledger_id,'amount_usd',previous.amount_usd,'source_amount',previous.source_amount,'source_currency',code,'exchange_rate',previous.exchange_rate);
 END IF;
 IF EXISTS(SELECT 1 FROM public.f90_wallet_ledger WHERE unique_key='manual:'||p_request::text) THEN RAISE EXCEPTION 'F90_IDEMPOTENCY_CONFLICT'; END IF;
 SELECT per_usd INTO fx FROM public.f90_rates WHERE currency=code AND is_enabled AND NOT is_archived FOR SHARE;
 IF fx IS NULL OR fx<=0 THEN RAISE EXCEPTION 'F90_RATE_MISSING'; END IF;
 IF p_expected_rate IS NULL OR abs(fx-p_expected_rate)>0.00000001 THEN RAISE EXCEPTION 'F90_RATE_CHANGED'; END IF;
 converted:=round(p_amount/fx,6);
 IF converted=0 OR abs(converted)>100000 THEN RAISE EXCEPTION 'F90_AMOUNT'; END IF;
 result:=public.f90_finance_adjust(p_actor,p_user,converted,left(btrim(p_note),350)||' · '||p_amount::text||' '||code||' بسعر '||fx::text||' لكل دولار',p_request,p_expected);
 INSERT INTO public.f90_currency_adjustments(request_id,actor_id,user_id,source_amount,source_currency,exchange_rate,amount_usd,reason,ledger_id,balance_after)
 VALUES(p_request,p_actor,p_user,p_amount,code,fx,converted,btrim(p_note),(result->>'reference_id')::uuid,(result->>'balance_usd')::numeric);
 INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,'wallet.currency_adjust',p_user::text,jsonb_build_object('amount',p_amount,'currency',code,'exchange_rate',fx,'amount_usd',converted,'request_id',p_request,'reason',btrim(p_note)));
 RETURN result||jsonb_build_object('amount_usd',converted,'source_amount',p_amount,'source_currency',code,'exchange_rate',fx);
END $$;
REVOKE ALL ON FUNCTION public.f90_finance_adjust_currency(uuid,uuid,numeric,text,text,uuid,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_finance_adjust_currency(uuid,uuid,numeric,text,text,uuid,numeric,numeric) TO service_role;

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
;

CREATE OR REPLACE FUNCTION public.f90_quote(p_user uuid,p_product uuid,p_quantity bigint DEFAULT 1,p_coupon text DEFAULT '')
RETURNS jsonb LANGUAGE sql SET search_path='' AS $$ SELECT public.f90_quote_currency(p_user,p_product,p_quantity,p_coupon,'USD'); $$;
REVOKE ALL ON FUNCTION public.f90_quote_currency(uuid,uuid,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_quote_currency(uuid,uuid,bigint,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.f90_checkout(p_user uuid, p_product uuid, p_quantity bigint, p_fields jsonb, p_key text, p_expected numeric, p_coupon text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE o public.f90_orders%ROWTYPE;p public.products%ROWTYPE;q jsonb;bal numeric;total numeric;internal public.f90_product_internal%ROWTYPE;f jsonb;fname text;mode text;reservation boolean:=false;
BEGIN
 PERFORM f90_private.require_actor(p_user);
 IF p_key IS NULL OR length(p_key)<8 OR length(p_key)>160 THEN RAISE EXCEPTION 'F90_IDEMPOTENCY'; END IF;
 -- Serialize all purchases and deposits for this wallet, including idempotent retries.
 SELECT balance_usd INTO bal FROM public.f90_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO o FROM public.f90_orders WHERE user_id=p_user AND idempotency_key=p_key;
 IF FOUND THEN
  -- Wallet row lock serializes retries, including concurrent requests.
  IF o.product_id IS DISTINCT FROM p_product
     OR o.customer_fields IS DISTINCT FROM p_fields
     OR (EXISTS(SELECT 1 FROM public.products rp WHERE rp.id=o.product_id AND rp.commerce->>'type'='quantity')
         AND o.quantity IS DISTINCT FROM p_quantity)
  THEN RAISE EXCEPTION 'F90_IDEMPOTENCY_CONFLICT'; END IF;
  RETURN to_jsonb(o);
 END IF;
 SELECT * INTO p FROM public.products WHERE id=p_product FOR UPDATE;
 q:=public.f90_quote(p_user,p_product,p_quantity,p_coupon);total:=(q->>'total_usd')::numeric;
 IF p_expected IS NULL OR abs(p_expected-total)>0.000001 THEN RAISE EXCEPTION 'F90_PRICE_CHANGED'; END IF;
 IF bal IS NULL OR bal<total THEN RAISE EXCEPTION 'F90_INSUFFICIENT_BALANCE'; END IF;
 IF jsonb_typeof(p_fields)<>'object' OR length(p_fields::text)>12000 THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 IF jsonb_array_length(coalesce(p.commerce->'fields','[]'))=0 AND nullif(trim(p_fields->>'account_id'),'') IS NULL THEN RAISE EXCEPTION 'F90_ACCOUNT_ID'; END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(coalesce(p.commerce->'fields','[]')) LOOP
  fname:=f->>'id';IF coalesce((f->>'required')::boolean,false) AND nullif(trim(p_fields->>fname),'') IS NULL THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 END LOOP;
 SELECT * INTO internal FROM public.f90_product_internal WHERE product_id=p.id;
 mode:=coalesce(p.commerce->>'fulfillment','manual');
 IF mode='automatic' AND (internal.provider_id IS NULL OR internal.provider_service IS NULL OR NOT EXISTS(SELECT 1 FROM public.f90_providers WHERE id=internal.provider_id AND is_enabled AND secret_id IS NOT NULL)) THEN RAISE EXCEPTION 'F90_PROVIDER_NOT_READY'; END IF;
 IF p.stock IS NOT NULL THEN
  IF p.stock<1 THEN RAISE EXCEPTION 'F90_REFILLING'; END IF;
  UPDATE public.products SET stock=stock-1 WHERE id=p.id;reservation:=true;
 END IF;
 INSERT INTO public.f90_orders(user_id,product_id,product_name,product_image,quantity,unit_quantity,subtotal_usd,discount_usd,total_usd,cost_usd,vip_level,coupon_code,customer_fields,fulfillment,status,provider_id,provider_service,expected_minutes,idempotency_key,stock_reserved,price_currency,subtotal_currency,discount_currency,total_currency,pricing_exchange_rate,purchase_markup_percent)
 VALUES(p_user,p.id,p.name,p.image_url,(q->>'quantity')::bigint,(q->>'unit_quantity')::bigint,(q->>'subtotal_usd')::numeric,(q->>'discount_usd')::numeric,total,
 CASE WHEN internal.cost_usd IS NULL THEN NULL ELSE round(internal.cost_usd*CASE WHEN p.commerce->>'type'='quantity' THEN (q->>'quantity')::numeric/(q->>'unit_quantity')::numeric ELSE 1 END,6) END,
 (q->>'vip_level')::smallint,q->>'coupon_code',p_fields,mode,CASE WHEN mode='automatic' THEN 'queued' ELSE 'pending' END,internal.provider_id,internal.provider_service,nullif(p.commerce->>'expected_minutes','')::integer,p_key,reservation,q->>'price_currency',(q->>'subtotal_currency')::numeric,(q->>'discount_currency')::numeric,(q->>'total_currency')::numeric,(q->>'pricing_exchange_rate')::numeric,(q->>'purchase_markup_percent')::numeric) RETURNING * INTO o;
 UPDATE public.f90_wallets SET balance_usd=bal-total,updated_at=now() WHERE user_id=p_user;
 INSERT INTO public.f90_wallet_ledger(user_id,amount_usd,balance_after,kind,reference_id,description,unique_key)
 VALUES(p_user,-total,bal-total,'purchase',o.id,'شراء: '||p.name,'purchase:'||o.id);
 INSERT INTO public.f90_order_events(order_id,status,note) VALUES(o.id,o.status,'تم تأكيد الدفع من المحفظة');
 RETURN to_jsonb(o);
END; $function$
;
