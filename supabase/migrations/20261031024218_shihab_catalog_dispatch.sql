-- Shihab only: no wallet/order data updates and no retail repricing.
CREATE TABLE IF NOT EXISTS f90_private.shihab_catalog_source (
  provider_service text PRIMARY KEY,
  source jsonb NOT NULL,
  evidence jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE f90_private.shihab_catalog_source ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON f90_private.shihab_catalog_source FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON f90_private.shihab_catalog_source TO service_role;

CREATE OR REPLACE FUNCTION public.f90_shihab_apply_snapshot(p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE provider uuid; row record; item jsonb; c jsonb; evidence jsonb;
  matched integer:=0; unavailable integer:=0; confirmed_auto integer:=0; confirmed_manual integer:=0;
BEGIN
  SELECT id INTO provider FROM public.f90_providers
   WHERE adapter='shihab' AND endpoint='https://api.shihabcard.com' AND is_enabled
   AND config->>'archived_at' IS NULL AND coalesce((config->>'disconnected')::boolean,false)=false
   AND config->>'sync_enabled'='true' FOR UPDATE;
  IF provider IS NULL THEN RAISE EXCEPTION 'F90_PROVIDER_NOT_READY'; END IF;
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 100 AND 5000
     OR length(p_items::text)>3000000 THEN RAISE EXCEPTION 'F90_CATALOG_INVALID'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) e WHERE e->>'id' IS NULL OR e->>'id' !~ '^[0-9]{1,100}$'
      OR jsonb_typeof(e->'available') IS DISTINCT FROM 'boolean')
     OR (SELECT count(*)<>count(DISTINCT e->>'id') FROM jsonb_array_elements(p_items)e)
    THEN RAISE EXCEPTION 'F90_CATALOG_INVALID'; END IF;
  SELECT count(*) INTO matched FROM public.f90_product_internal i
   JOIN jsonb_array_elements(p_items) e ON e->>'id'=i.provider_service WHERE i.provider_id=provider;
  IF matched < (SELECT count(*)*0.8 FROM public.f90_product_internal WHERE provider_id=provider)
    THEN RAISE EXCEPTION 'F90_CATALOG_INCOMPLETE'; END IF;
  INSERT INTO f90_private.shihab_catalog_source(provider_service,source,evidence,observed_at)
  SELECT e->>'id',e->'source',nullif(e->'evidence','null'::jsonb),now() FROM jsonb_array_elements(p_items)e
  ON CONFLICT(provider_service) DO UPDATE SET source=excluded.source,evidence=excluded.evidence,observed_at=excluded.observed_at;
  FOR row IN SELECT p.id,p.commerce,i.provider_service FROM public.products p
    JOIN public.f90_product_internal i ON i.product_id=p.id WHERE i.provider_id=provider FOR UPDATE OF p LOOP
    SELECT e INTO item FROM jsonb_array_elements(p_items)e WHERE e->>'id'=row.provider_service;
    c:=coalesce(row.commerce,'{}'::jsonb);
    evidence:=nullif(item->'evidence','null'::jsonb);
    IF evidence->>'mode' IN ('automatic','manual') THEN
      c:=c||jsonb_build_object('fulfillment',evidence->>'mode','fulfillment_status','confirmed',
        'fulfillment_evidence',evidence||jsonb_build_object('source','shihab/products','provider_service',row.provider_service));
    ELSIF c->>'fulfillment_status' IS DISTINCT FROM 'confirmed' THEN
      -- Legacy manual is retained internally but explicitly NOT presented as verified.
      c:=c||'{"fulfillment_status":"unconfirmed","fulfillment_reason":"supplier_api_missing_execution_metadata"}'::jsonb;
    END IF;
    IF item IS NULL OR item->>'available'<>'true' THEN
      unavailable:=unavailable+1;
      IF c->>'supplier_refilling' IS DISTINCT FROM 'true' THEN
        c:=c||jsonb_build_object('supplier_previous_availability',coalesce(c->>'availability','available'));
      END IF;
      c:=c||'{"supplier_available":false,"supplier_refilling":true,"availability":"refilling"}'::jsonb;
    ELSE
      IF c->>'supplier_refilling'='true' THEN
        c:=(c-'supplier_refilling'-'supplier_previous_availability')||
          jsonb_build_object('availability',coalesce(c->>'supplier_previous_availability','available'));
      END IF;
      c:=c||'{"supplier_available":true}'::jsonb;
    END IF;
    IF c->>'fulfillment_status'='confirmed' THEN
      IF c->>'fulfillment'='automatic' THEN confirmed_auto:=confirmed_auto+1; ELSE confirmed_manual:=confirmed_manual+1; END IF;
    END IF;
    UPDATE public.products SET commerce=c WHERE id=row.id AND commerce IS DISTINCT FROM c;
  END LOOP;
  UPDATE public.f90_providers SET config=(config-'sync_error')||jsonb_build_object(
    'sync_state','ok','sync_last_success',now(),'sync_last_catalog_count',jsonb_array_length(p_items),
    'sync_matched',matched,'sync_unavailable',unavailable,'fulfillment_confirmed_auto',confirmed_auto,
    'fulfillment_confirmed_manual',confirmed_manual,'fulfillment_unconfirmed',matched-confirmed_auto-confirmed_manual)
    WHERE id=provider;
  RETURN jsonb_build_object('matched',matched,'catalog_count',jsonb_array_length(p_items),
    'automatic',confirmed_auto,'manual',confirmed_manual,'unconfirmed',matched-confirmed_auto-confirmed_manual,'unavailable',unavailable);
END $$;
REVOKE ALL ON FUNCTION public.f90_shihab_apply_snapshot(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_shihab_apply_snapshot(jsonb) TO service_role;

-- Patch the CURRENT production checkout, preserving all unrelated pricing and auth fixes.
DO $$ DECLARE d text; needle text; BEGIN
 d:=pg_get_functiondef('public.f90_checkout(uuid,uuid,bigint,jsonb,text,numeric,text)'::regprocedure);
 needle:=' IF mode=''automatic'' AND (internal.provider_id IS NULL';
 IF position(needle IN d)=0 THEN RAISE EXCEPTION 'Unexpected checkout definition'; END IF;
 d:=replace(d,needle,$patch$
 IF internal.provider_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.f90_providers WHERE id=internal.provider_id AND adapter='shihab') THEN
   SELECT EXISTS(SELECT 1 FROM public.f90_providers pr WHERE pr.id=internal.provider_id AND pr.is_enabled
     AND pr.endpoint='https://api.shihabcard.com' AND pr.config->>'automatic_orders_enabled'='true'
     AND pr.config->>'sync_state'='ok' AND pr.config->>'archived_at' IS NULL
     AND coalesce((pr.config->>'disconnected')::boolean,false)=false
     AND nullif(btrim(internal.provider_service),'') IS NOT NULL) INTO supplier_dispatch;
   IF NOT supplier_dispatch OR p.commerce->>'supplier_available' IS DISTINCT FROM 'true' THEN
     RAISE EXCEPTION 'F90_PROVIDER_NOT_READY';
   END IF;
 END IF;
 IF mode='automatic' AND NOT supplier_dispatch AND (internal.provider_id IS NULL$patch$);
 EXECUTE d;
END $$;

CREATE OR REPLACE FUNCTION f90_private.shihab_sync_tick() RETURNS bigint
LANGUAGE plpgsql SET search_path='' AS $$ DECLARE request_id bigint; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.f90_providers WHERE adapter='shihab' AND is_enabled
   AND config->>'sync_enabled'='true' AND config->>'archived_at' IS NULL
   AND coalesce((config->>'disconnected')::boolean,false)=false) THEN RETURN NULL; END IF;
 SELECT net.http_post(url:='https://ogkipkavlywgwhtomoca.supabase.co/functions/v1/f90-platform',
   headers:=jsonb_build_object('Content-Type','application/json','x-f90-worker',
     (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='f90-worker')),
   body:='{"action":"shihab.sync"}'::jsonb,timeout_milliseconds:=60000) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION f90_private.shihab_sync_tick() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('f90-shihab-sync','*/15 * * * *','select f90_private.shihab_sync_tick()');
