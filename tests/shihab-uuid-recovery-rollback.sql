BEGIN;
DO $$
DECLARE u uuid:=gen_random_uuid(); oid uuid:=gen_random_uuid(); pid uuid; claimed jsonb; item jsonb;
BEGIN
 -- Do not contend with real due work while running this isolated acceptance test.
 IF EXISTS(SELECT 1 FROM public.f90_orders WHERE status IN ('queued','processing','submitting') AND next_sync_at<=now())
 THEN RAISE EXCEPTION 'Production work is due; run isolated acceptance later'; END IF;
 SELECT id INTO STRICT pid FROM public.f90_providers WHERE adapter='shihab' AND endpoint='https://api.shihabcard.com';
 INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
 VALUES(u,'shihab-uuid-'||u||'@example.invalid','{"display_name":"UUID rollback acceptance"}','{}');
 INSERT INTO public.f90_orders(id,user_id,product_name,quantity,unit_quantity,subtotal_usd,total_usd,
   fulfillment,status,provider_id,provider_service,idempotency_key,dispatch_attempts,next_sync_at,updated_at)
 VALUES(oid,u,'UUID rollback acceptance',1,1,10,10,'manual','submitting',pid,'99999999999999999',
   'isolated-uuid-'||oid,1,now()-interval '10 minutes',now()-interval '10 minutes');
 claimed:=public.f90_claim_work();
 SELECT e INTO item FROM jsonb_array_elements(claimed)e WHERE e->>'id'=oid::text;
 IF item IS NULL OR item->>'status'<>'review' OR item->>'provider_status'<>'submission_uncertain'
    OR item->>'dispatch_attempts'<>'1' THEN RAISE EXCEPTION 'Ambiguous submission not claimed safely'; END IF;
 claimed:=public.f90_claim_work();
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(claimed)e WHERE e->>'id'=oid::text)
 THEN RAISE EXCEPTION 'Recovery lease allows concurrent duplicate work'; END IF;
 UPDATE public.f90_orders SET provider_status='manual_review',next_sync_at=now()-interval '1 minute' WHERE id=oid;
 claimed:=public.f90_claim_work();
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(claimed)e WHERE e->>'id'=oid::text)
 THEN RAISE EXCEPTION 'Staff review incorrectly claimed'; END IF;
 IF (SELECT count(*) FROM public.f90_wallet_ledger WHERE user_id=u)<>0
 THEN RAISE EXCEPTION 'Recovery test touched funds'; END IF;
END $$;
SELECT 'PASS: stale Shihab submission enters read-only recovery, no repeated dispatch, lease prevents duplicate claim, staff reviews excluded, no wallet transaction; ROLLBACK' result;
ROLLBACK;
