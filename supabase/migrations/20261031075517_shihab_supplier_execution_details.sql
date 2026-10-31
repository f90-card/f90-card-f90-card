ALTER TABLE f90_private.shihab_catalog_source
 ADD COLUMN IF NOT EXISTS details jsonb,
 ADD COLUMN IF NOT EXISTS details_checked_at timestamptz,
 ADD COLUMN IF NOT EXISTS details_next_at timestamptz NOT NULL DEFAULT '-infinity';
CREATE OR REPLACE FUNCTION public.f90_shihab_claim_details() RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$ DECLARE result jsonb; BEGIN
 WITH candidates AS (
  SELECT s.provider_service FROM f90_private.shihab_catalog_source s
  JOIN public.f90_product_internal i ON i.provider_service=s.provider_service
  JOIN public.f90_providers pr ON pr.id=i.provider_id
  WHERE pr.adapter='shihab' AND pr.is_enabled AND pr.config->>'sync_enabled'='true'
   AND pr.config->>'archived_at' IS NULL AND coalesce((pr.config->>'disconnected')::boolean,false)=false
   AND s.details_next_at<=now()
  ORDER BY s.details_checked_at NULLS FIRST,s.provider_service FOR UPDATE OF s SKIP LOCKED LIMIT 20
 ), claimed AS (
  UPDATE f90_private.shihab_catalog_source s SET details_next_at=now()+interval '2 minutes'
  FROM candidates c WHERE s.provider_service=c.provider_service RETURNING s.provider_service
 ) SELECT coalesce(jsonb_agg(provider_service),'[]') INTO result FROM claimed;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.f90_shihab_claim_details() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_shihab_claim_details() TO service_role;

CREATE OR REPLACE FUNCTION public.f90_shihab_apply_details(p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE e jsonb; pr uuid; row record; c jsonb; processed integer:=0;
BEGIN
 SELECT id INTO STRICT pr FROM public.f90_providers WHERE adapter='shihab' AND endpoint='https://api.shihabcard.com' FOR UPDATE;
 IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>250 OR length(p_items::text)>4000000
 THEN RAISE EXCEPTION 'F90_DETAILS_INVALID'; END IF;
 IF (SELECT count(*)<>count(DISTINCT x->>'id') FROM jsonb_array_elements(p_items)x)
 THEN RAISE EXCEPTION 'F90_DETAILS_DUPLICATE'; END IF;
 FOR e IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  IF e->>'id' IS NULL OR e->>'id' !~ '^[0-9]{1,100}$' OR e->'source'->>'id' IS DISTINCT FROM e->>'id'
   THEN RAISE EXCEPTION 'F90_DETAILS_ID'; END IF;
  SELECT p.id,p.commerce INTO STRICT row FROM public.products p JOIN public.f90_product_internal i ON i.product_id=p.id
   WHERE i.provider_id=pr AND i.provider_service=e->>'id' FOR UPDATE OF p;
  c:=coalesce(row.commerce,'{}'::jsonb);
  IF e->>'mode' IN ('automatic','manual') AND e->'evidence'->>'mode'=e->>'mode'
   AND e->'evidence'->>'source'='supplier_product_description' THEN
   c:=c||jsonb_build_object('fulfillment',e->>'mode','fulfillment_status','confirmed','fulfillment_evidence',
     e->'evidence'||jsonb_build_object('provider_service',e->>'id','observed_at',now()));
  ELSIF c->>'fulfillment_status' IS DISTINCT FROM 'confirmed' THEN
   c:=c||'{"fulfillment_status":"unconfirmed","fulfillment_reason":"supplier_description_does_not_specify_execution_type"}'::jsonb;
  END IF;
  c:=c||jsonb_build_object('supplier_details_checked_at',now(),'supplier_delivery_time',nullif(e->'delivery','null'::jsonb));
  UPDATE public.products SET commerce=c WHERE id=row.id AND commerce IS DISTINCT FROM c;
  UPDATE f90_private.shihab_catalog_source SET details=e,details_checked_at=now(),details_next_at=now()+interval '15 minutes'
   WHERE provider_service=e->>'id';
  processed:=processed+1;
 END LOOP;
 UPDATE public.f90_providers SET config=config||jsonb_build_object('details_last_success',now(),
  'fulfillment_confirmed_auto',(SELECT count(*) FROM public.products p JOIN public.f90_product_internal i ON i.product_id=p.id WHERE i.provider_id=pr AND p.commerce->>'fulfillment_status'='confirmed' AND p.commerce->>'fulfillment'='automatic'),
  'fulfillment_confirmed_manual',(SELECT count(*) FROM public.products p JOIN public.f90_product_internal i ON i.product_id=p.id WHERE i.provider_id=pr AND p.commerce->>'fulfillment_status'='confirmed' AND p.commerce->>'fulfillment'='manual'),
  'fulfillment_unconfirmed',(SELECT count(*) FROM public.products p JOIN public.f90_product_internal i ON i.product_id=p.id WHERE i.provider_id=pr AND p.commerce->>'fulfillment_status' IS DISTINCT FROM 'confirmed')) WHERE id=pr;
 RETURN jsonb_build_object('processed',processed);
END $$;
REVOKE ALL ON FUNCTION public.f90_shihab_apply_details(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_shihab_apply_details(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION f90_private.shihab_details_tick() RETURNS bigint
LANGUAGE plpgsql SET search_path='' AS $$ DECLARE request_id bigint; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.f90_providers WHERE adapter='shihab' AND is_enabled AND config->>'sync_enabled'='true') THEN RETURN NULL; END IF;
 SELECT net.http_post(url:='https://ogkipkavlywgwhtomoca.supabase.co/functions/v1/f90-platform',
  headers:=jsonb_build_object('Content-Type','application/json','x-f90-worker',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='f90-worker')),
  body:='{"action":"shihab.details"}'::jsonb,timeout_milliseconds:=60000) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION f90_private.shihab_details_tick() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('f90-shihab-execution-details','* * * * *','select f90_private.shihab_details_tick()');
