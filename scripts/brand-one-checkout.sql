DO $migration$
DECLARE d text; old_clause text; new_clause text;
BEGIN
 d:=pg_get_functiondef('public.f90_checkout(uuid,uuid,bigint,jsonb,text,numeric,text)'::regprocedure);
 old_clause:=$old$IF jsonb_array_length(coalesce(p.commerce->'fields','[]'))=0 AND nullif(trim(p_fields->>'account_id'),'') IS NULL THEN RAISE EXCEPTION 'F90_ACCOUNT_ID'; END IF;$old$;
 new_clause:=$new$IF jsonb_array_length(coalesce(p.commerce->'fields','[]'))=0 AND p.commerce->>'supplier_catalog' IS DISTINCT FROM 'brand_one' AND nullif(trim(p_fields->>'account_id'),'') IS NULL THEN RAISE EXCEPTION 'F90_ACCOUNT_ID'; END IF;$new$;
 IF position(old_clause IN d)=0 THEN RAISE EXCEPTION 'Unexpected checkout account field guard'; END IF;
 d:=replace(d,old_clause,new_clause);
 d:=replace(d,$old$('yassen','smm','f90_merchant')$old$,$new$('yassen','smm','f90_merchant','brand_one')$new$);
 old_clause:=$old$IF mode='automatic' AND NOT supplier_dispatch$old$;
 new_clause:=$new$
 IF internal.provider_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.f90_providers WHERE id=internal.provider_id AND adapter='brand_one') THEN
  SELECT EXISTS(SELECT 1 FROM public.f90_providers pr WHERE pr.id=internal.provider_id AND pr.is_enabled
   AND pr.secret_id IS NOT NULL AND pr.endpoint='https://api.brand-one-card.com'
   AND pr.config->>'automatic_orders_enabled'='true' AND pr.config->>'sync_state'='ok'
   AND pr.config->>'archived_at' IS NULL AND coalesce((pr.config->>'disconnected')::boolean,false)=false
   AND nullif(btrim(internal.provider_service),'') IS NOT NULL) INTO supplier_dispatch;
  IF NOT supplier_dispatch OR p.commerce->>'supplier_available' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'F90_PROVIDER_NOT_READY'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.f90_user_roles WHERE user_id=p_user AND role='manager')
   AND NOT EXISTS(SELECT 1 FROM public.f90_providers WHERE id=internal.provider_id AND config->>'catalog_visibility'='public')
   THEN RAISE EXCEPTION 'F90_FORBIDDEN'; END IF;
 END IF;
 IF mode='automatic' AND NOT supplier_dispatch$new$;
 IF position(old_clause IN d)=0 THEN RAISE EXCEPTION 'Unexpected checkout dispatch guard'; END IF;
 d:=replace(d,old_clause,new_clause);
 EXECUTE d;
END $migration$;
