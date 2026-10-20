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
 INSERT INTO public.f90_orders(user_id,product_id,product_name,product_image,quantity,unit_quantity,subtotal_usd,discount_usd,total_usd,cost_usd,vip_level,coupon_code,customer_fields,fulfillment,status,provider_id,provider_service,expected_minutes,idempotency_key,stock_reserved)
 VALUES(p_user,p.id,p.name,p.image_url,(q->>'quantity')::bigint,(q->>'unit_quantity')::bigint,(q->>'subtotal_usd')::numeric,(q->>'discount_usd')::numeric,total,
 CASE WHEN internal.cost_usd IS NULL THEN NULL ELSE round(internal.cost_usd*CASE WHEN p.commerce->>'type'='quantity' THEN (q->>'quantity')::numeric/(q->>'unit_quantity')::numeric ELSE 1 END,6) END,
 (q->>'vip_level')::smallint,q->>'coupon_code',p_fields,mode,CASE WHEN mode='automatic' THEN 'queued' ELSE 'pending' END,internal.provider_id,internal.provider_service,nullif(p.commerce->>'expected_minutes','')::integer,p_key,reservation) RETURNING * INTO o;
 UPDATE public.f90_wallets SET balance_usd=bal-total,updated_at=now() WHERE user_id=p_user;
 INSERT INTO public.f90_wallet_ledger(user_id,amount_usd,balance_after,kind,reference_id,description,unique_key)
 VALUES(p_user,-total,bal-total,'purchase',o.id,'شراء: '||p.name,'purchase:'||o.id);
 INSERT INTO public.f90_order_events(order_id,status,note) VALUES(o.id,o.status,'تم تأكيد الدفع من المحفظة');
 RETURN to_jsonb(o);
END; $function$;