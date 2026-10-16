-- Deposit methods select currencies, including editable Xena coin rate.
-- Each enabled payment method may set its own future deposit fee.
-- Existing deposit snapshots and approved wallet movements stay unchanged.
CREATE OR REPLACE FUNCTION public.f90_submit_deposit(
 p_user uuid,p_method text,p_currency text,p_amount numeric,p_receipt text,p_reference text,p_key text
)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE
 rate numeric;
 method jsonb;
 d public.f90_deposits%ROWTYPE;
 pct numeric;
BEGIN
 PERFORM f90_private.require_actor(p_user);
 SELECT * INTO d FROM public.f90_deposits WHERE user_id=p_user AND idempotency_key=p_key;
 IF FOUND THEN RETURN to_jsonb(d); END IF;
 IF p_amount<=0 OR p_amount>(case when p_currency='XCN' then 1000000000000 else 1000000 end) OR length(p_key)<8 THEN RAISE EXCEPTION 'F90_AMOUNT'; END IF;
 SELECT per_usd INTO rate FROM public.f90_rates WHERE currency=p_currency AND is_enabled;
 IF rate IS NULL OR rate<=0 THEN RAISE EXCEPTION 'F90_RATE_MISSING'; END IF;
 SELECT m INTO method FROM public.site_settings s,
   jsonb_array_elements(coalesce(s.config->'payment_methods','[]'::jsonb)) m
 WHERE s.id=1 AND m->>'id'=p_method AND coalesce((m->>'enabled')::boolean,false);
 IF method IS NULL THEN RAISE EXCEPTION 'F90_PAYMENT_METHOD'; END IF;
 IF jsonb_typeof(method->'accepted_currencies')='array' AND NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements_text(method->'accepted_currencies') code WHERE code=p_currency
 ) THEN RAISE EXCEPTION 'F90_DEPOSIT_CURRENCY'; END IF;
 IF p_currency='XCN' AND p_amount<100000 THEN RAISE EXCEPTION 'F90_COIN_MINIMUM'; END IF;
 IF split_part(p_receipt,'/',1)<>p_user::text OR NOT EXISTS(
 SELECT 1 FROM storage.objects WHERE bucket_id='f90-receipts' AND name=p_receipt)
 THEN RAISE EXCEPTION 'F90_RECEIPT'; END IF;
 IF method ? 'deposit_fee_percent' THEN
  IF (method->>'deposit_fee_percent') !~ '^[0-9]{1,2}(\.[0-9]{1,3})?$'
    THEN RAISE EXCEPTION 'F90_DEPOSIT_FEE'; END IF;
  pct:=(method->>'deposit_fee_percent')::numeric;
 ELSE pct:=2; END IF;
 IF pct<0 OR pct>50 THEN RAISE EXCEPTION 'F90_DEPOSIT_FEE'; END IF;
 -- Fee/rate snapshots are immutable after submission, including when managers edit settings.
 method:=method||jsonb_build_object(
  'deposit_fee_percent',pct,
  'deposit_fee_reason','رسوم خدمة الإيداع '||pct||'٪'
 );
 INSERT INTO public.f90_deposits(
  user_id,method_id,method_name,method_snapshot,currency,amount,rate_snapshot,
  usd_amount,receipt_path,reference,idempotency_key
 ) VALUES(
  p_user,p_method,coalesce(method->>'name_ar',method->>'name',p_method),method,
  p_currency,p_amount,rate,round(p_amount/rate,6),p_receipt,left(p_reference,300),p_key
 ) RETURNING * INTO d;
 RETURN to_jsonb(d);
END; $fn$;
