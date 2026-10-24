-- Currency registry is authoritative; wallet and order amounts remain in USD.
ALTER TABLE public.f90_rates ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS f90_profile_account_currency_check;
ALTER TABLE public.profiles ADD CONSTRAINT f90_profile_account_currency_check CHECK (account_currency ~ '^[A-Z]{3,8}$');
ALTER TABLE public.profiles ADD CONSTRAINT f90_profile_account_currency_fk FOREIGN KEY(account_currency) REFERENCES public.f90_rates(currency) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION f90_private.validate_account_currency() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.account_currency IS NOT DISTINCT FROM OLD.account_currency THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.f90_rates WHERE currency=NEW.account_currency AND is_enabled AND NOT is_archived AND per_usd>0 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_RATE_MISSING'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION f90_private.validate_account_currency() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER f90_profile_currency_registry BEFORE INSERT OR UPDATE OF account_currency ON public.profiles
FOR EACH ROW EXECUTE FUNCTION f90_private.validate_account_currency();

CREATE OR REPLACE FUNCTION public.f90_manage_currency(p_actor uuid,p_action text,p_currency text DEFAULT '',p_name text DEFAULT '',p_rate numeric DEFAULT NULL,p_enabled boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE code text:=upper(trim(p_currency)); r public.f90_rates%rowtype; result jsonb; item record;
 deleted jsonb:='[]'; archived jsonb:='[]'; skipped jsonb:='[]';
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager']);
 IF p_action='purge' THEN
  FOR item IN SELECT currency FROM public.f90_rates WHERE NOT is_enabled AND NOT is_archived AND currency<>'USD' ORDER BY currency LOOP
   BEGIN
    result:=public.f90_manage_currency(p_actor,'delete',item.currency);
    IF (result->>'archived')::boolean THEN archived:=archived||to_jsonb(item.currency); ELSE deleted:=deleted||to_jsonb(item.currency); END IF;
   EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='F90_RATE_IN_USE' THEN skipped:=skipped||to_jsonb(item.currency); ELSE RAISE; END IF;
   END;
  END LOOP;
  RETURN jsonb_build_object('deleted',deleted,'archived',archived,'skipped',skipped);
 END IF;
 IF code !~ '^[A-Z]{3,8}$' THEN RAISE EXCEPTION 'F90_CURRENCY_CODE'; END IF;
 SELECT * INTO r FROM public.f90_rates WHERE currency=code FOR UPDATE;
 IF p_action NOT IN ('save','delete') THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 IF code='USD' AND (p_action='delete' OR NOT p_enabled OR p_rate IS DISTINCT FROM 1) THEN RAISE EXCEPTION 'F90_RATE_BASE'; END IF;
 -- A current account/provider/default must keep its usable exchange rate.
 IF p_action='delete' OR NOT p_enabled THEN
  IF EXISTS(SELECT 1 FROM public.profiles WHERE account_currency=code)
    OR EXISTS(SELECT 1 FROM public.f90_providers WHERE currency=code AND config->>'archived_at' IS NULL)
    OR EXISTS(SELECT 1 FROM public.site_settings WHERE currency=code) THEN RAISE EXCEPTION 'F90_RATE_IN_USE'; END IF;
 END IF;
 IF p_action='save' THEN
  IF nullif(trim(p_name),'') IS NULL OR length(trim(p_name))>100 OR p_rate IS NULL OR p_rate<=0 OR p_rate>100000000 THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
  INSERT INTO public.f90_rates(currency,name_ar,per_usd,is_enabled,is_archived,updated_at)
  VALUES(code,trim(p_name),p_rate,p_enabled,false,now())
  ON CONFLICT(currency) DO UPDATE SET name_ar=excluded.name_ar,per_usd=excluded.per_usd,is_enabled=excluded.is_enabled,is_archived=false,updated_at=now()
  RETURNING * INTO r;
  result:=to_jsonb(r);
 ELSE
  IF r.currency IS NULL THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
  -- Keep rows referenced by historical financial snapshots or archived suppliers.
  IF EXISTS(SELECT 1 FROM public.f90_deposits WHERE currency=code)
    OR EXISTS(SELECT 1 FROM public.f90_providers WHERE currency=code)
    OR EXISTS(SELECT 1 FROM public.products WHERE currency=code)
    OR EXISTS(SELECT 1 FROM public.orders WHERE currency=code)
    OR EXISTS(SELECT 1 FROM public.f90_salary_requests WHERE payout_currency=code)
    OR EXISTS(SELECT 1 FROM public.f90_transfer_requests WHERE target_currency=code)
    OR EXISTS(SELECT 1 FROM public.f90_trader_commissions WHERE account_currency=code)
    OR EXISTS(SELECT 1 FROM public.f90_partner_products WHERE currency=code)
    OR EXISTS(SELECT 1 FROM public.f90_quantity_price_tiers WHERE currency=code) THEN
   UPDATE public.f90_rates SET is_archived=true,is_enabled=false,updated_at=now() WHERE currency=code;
   result:=jsonb_build_object('currency',code,'deleted',false,'archived',true);
  ELSE
   DELETE FROM public.f90_rates WHERE currency=code;
   result:=jsonb_build_object('currency',code,'deleted',true,'archived',false);
  END IF;
 END IF;
 INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,'currency.'||p_action,code,result);
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.f90_manage_currency(uuid,text,text,text,numeric,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_manage_currency(uuid,text,text,text,numeric,boolean) TO service_role;

-- Keep the existing bootstrap and payout policies, only replace currency whitelists.
DO $$ DECLARE src text; BEGIN
 SELECT pg_get_functiondef('f90_private.on_auth_user()'::regprocedure) INTO src;
 IF position('IN (''USD'', ''ILS'', ''JOD'')' in src)=0 THEN RAISE EXCEPTION 'Unexpected auth currency definition'; END IF;
 src:=replace(src,'NEW.raw_user_meta_data->>''account_currency'' IN (''USD'', ''ILS'', ''JOD'')',
 'EXISTS(SELECT 1 FROM public.f90_rates WHERE currency=upper(trim(NEW.raw_user_meta_data->>''account_currency'')) AND is_enabled AND NOT is_archived AND per_usd>0)');
 src:=replace(src,'THEN NEW.raw_user_meta_data->>''account_currency''','THEN upper(trim(NEW.raw_user_meta_data->>''account_currency''))');
 EXECUTE src;
 SELECT pg_get_functiondef('public.f90_submit_salary_v3(text,bigint,text,uuid,text,text)'::regprocedure) INTO src;
 src:=replace(src,'v_currency !~ ''^(USD|ILS|JOD)$''','v_currency !~ ''^[A-Z]{3,8}$''');
 EXECUTE src;
END; $$;

-- Owner request: enable SAR at exactly 3.77 and remove all other unused inactive currencies.
DO $$ DECLARE actor uuid; BEGIN
 SELECT r.user_id INTO actor FROM public.f90_user_roles r JOIN public.profiles p ON p.id=r.user_id
 WHERE r.role='manager' AND p.account_status='active' ORDER BY r.user_id LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'F90_FORBIDDEN'; END IF;
 PERFORM public.f90_manage_currency(actor,'save','SAR','ريال سعودي',3.77,true);
 PERFORM public.f90_manage_currency(actor,'purge');
END; $$;
