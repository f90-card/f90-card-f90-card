-- F90 CARD: review before applying to production.
-- New deposits only. Historical deposits remain unchanged.
-- The database must be the only authority for the fee and net wallet credit.
-- Apply both function replacements in a single migration transaction.
BEGIN;
CREATE OR REPLACE FUNCTION public.f90_submit_deposit(p_user uuid, p_method text, p_currency text, p_amount numeric, p_receipt text, p_reference text, p_key text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE rate numeric; method jsonb; d public.f90_deposits%ROWTYPE;
BEGIN
 PERFORM f90_private.require_actor(p_user);
 SELECT * INTO d FROM public.f90_deposits WHERE user_id=p_user AND idempotency_key=p_key;
 IF FOUND THEN RETURN to_jsonb(d); END IF;
 IF p_amount<=0 OR p_amount>1000000 OR length(p_key)<8 THEN RAISE EXCEPTION 'F90_AMOUNT'; END IF;
 SELECT per_usd INTO rate FROM public.f90_rates WHERE currency=p_currency AND is_enabled;
 IF rate IS NULL OR rate<=0 THEN RAISE EXCEPTION 'F90_RATE_MISSING'; END IF;
 SELECT m INTO method FROM public.site_settings s,jsonb_array_elements(coalesce(s.config->'payment_methods','[]'::jsonb)) m
 WHERE s.id=1 AND m->>'id'=p_method AND coalesce((m->>'enabled')::boolean,false);
 IF method IS NULL THEN RAISE EXCEPTION 'F90_PAYMENT_METHOD'; END IF;
 IF split_part(p_receipt,'/',1)<>p_user::text OR NOT EXISTS
  (SELECT 1 FROM storage.objects WHERE bucket_id='f90-receipts' AND name=p_receipt)
 THEN RAISE EXCEPTION 'F90_RECEIPT'; END IF;
 -- Snapshot is immutable: future rate/fee changes cannot affect existing deposits.
 method:=method||jsonb_build_object('deposit_fee_percent',2,'deposit_fee_reason','رسوم خدمة الإيداع 2٪');
 INSERT INTO public.f90_deposits(user_id,method_id,method_name,method_snapshot,currency,amount,rate_snapshot,usd_amount,receipt_path,reference,idempotency_key)
 VALUES(p_user,p_method,coalesce(method->>'name_ar',method->>'name',p_method),method,p_currency,p_amount,rate,round(p_amount/rate,6),p_receipt,left(p_reference,300),p_key)
 RETURNING * INTO d;
 RETURN to_jsonb(d);
END; $fn$;
CREATE OR REPLACE FUNCTION public.f90_review_deposit(p_actor uuid,p_id uuid,p_approve boolean,p_note text DEFAULT ''::text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE d public.f90_deposits%ROWTYPE; bal numeric; pct numeric; fee numeric; net numeric;
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager','admin']);
 SELECT * INTO d FROM public.f90_deposits WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
 IF d.status<>'pending' THEN RETURN to_jsonb(d); END IF;
 pct:=CASE WHEN d.method_snapshot ? 'deposit_fee_percent'
 THEN LEAST(100,GREATEST(0,(d.method_snapshot->>'deposit_fee_percent')::numeric)) ELSE 0 END;
 fee:=round(d.usd_amount*pct/100,6);
 net:=d.usd_amount-fee;
 IF p_approve THEN
  SELECT balance_usd INTO bal FROM public.f90_wallets WHERE user_id=d.user_id FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'F90_WALLET_MISSING'; END IF;
  UPDATE public.f90_wallets SET balance_usd=bal+net,updated_at=now() WHERE user_id=d.user_id;
  INSERT INTO public.f90_wallet_ledger(user_id,amount_usd,balance_after,kind,reference_id,description,unique_key,actor_id)
  VALUES(d.user_id,net,bal+net,'deposit',d.id,'اعتماد إيداع: '||d.method_name||
   CASE WHEN pct>0 THEN ' · رسوم خدمة الإيداع '||pct||'٪: -'||fee||' USD' ELSE '' END,
   'deposit:'||d.id,p_actor);
 END IF;
 UPDATE public.f90_deposits SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 review_note=left(p_note,2000),reviewed_by=p_actor,reviewed_at=now() WHERE id=d.id RETURNING * INTO d;
 INSERT INTO public.f90_audit(actor_id,action,target_id,details)
 VALUES(p_actor,'deposit.review',d.id::text,jsonb_build_object('status',d.status,'gross_usd',d.usd_amount,'fee_usd',fee,'net_usd',net,'fee_percent',pct));
 RETURN to_jsonb(d);
END; $fn$;
COMMIT;
