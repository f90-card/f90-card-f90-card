-- Only Shihab's ambiguous submissions gain read-only UUID reconciliation.
-- Do not re-dispatch, refund, or alter other suppliers' review rules.
DO $$
DECLARE definition text; original text; replacement text;
BEGIN
 definition:=pg_get_functiondef('public.f90_claim_work()'::regprocedure);
 original:='SET status=''review'',updated_at=now() WHERE status=''submitting''';
 replacement:='SET status=''review'',provider_status=CASE WHEN provider_id=''9c95e9bc-8930-490d-bb23-92d67a0dc428'' AND provider_order_id IS NULL THEN ''submission_uncertain'' ELSE provider_status END,updated_at=now() WHERE status=''submitting''';
 IF position(original IN definition)=0 THEN RAISE EXCEPTION 'Unexpected work claim definition'; END IF;
 definition:=replace(definition,original,replacement);
 original:='AND status IN (''queued'',''processing'') AND next_sync_at<=now()';
 replacement:='AND (status IN (''queued'',''processing'') OR (provider_id=''9c95e9bc-8930-490d-bb23-92d67a0dc428'' AND status=''review'' AND provider_status=''submission_uncertain'' AND provider_order_id IS NULL)) AND next_sync_at<=now()';
 IF position(original IN definition)=0 THEN RAISE EXCEPTION 'Unexpected work selection'; END IF;
 definition:=replace(definition,original,replacement);
 EXECUTE definition;

 definition:=pg_get_functiondef('f90_private.tick()'::regprocedure);
 original:='status in (''queued'',''processing'') and next_sync_at<=now()';
 replacement:='(status in (''queued'',''processing'') OR (provider_id=''9c95e9bc-8930-490d-bb23-92d67a0dc428'' AND status=''review'' AND provider_status=''submission_uncertain'' AND provider_order_id IS NULL)) and next_sync_at<=now()';
 IF position(original IN definition)=0 THEN RAISE EXCEPTION 'Unexpected worker scheduler'; END IF;
 EXECUTE replace(definition,original,replacement);

 -- Missing supplier IDs remain part of the mapped catalog's unconfirmed total.
 definition:=pg_get_functiondef('public.f90_shihab_apply_snapshot(jsonb)'::regprocedure);
 original:='matched-confirmed_auto-confirmed_manual';
 replacement:='(SELECT count(*) FROM public.f90_product_internal WHERE provider_id=provider)-confirmed_auto-confirmed_manual';
 IF position(original IN definition)=0 THEN RAISE EXCEPTION 'Unexpected snapshot counter'; END IF;
 EXECUTE replace(definition,original,replacement);
END $$;
