-- Exercises the real claim function without invoking a sender or network request.
-- All queue changes are rolled back; no historical notification is delivered.
begin;
do $f90$
declare cutoff timestamptz:=now();before_queue jsonb;test_id bigint;claimed bigint;reclaimed bigint;deposit uuid;
begin
 if (f90_private.cutover_readiness()->>'jobs_enabled')::int<>0 then raise exception 'F90_TARGET_NOT_ISOLATED';end if;
 if has_function_privilege('anon','public.f90_mail_claim_after(timestamptz,integer)','execute') or has_function_privilege('authenticated','public.f90_mail_claim_after(timestamptz,integer)','execute') or not has_function_privilege('service_role','public.f90_mail_claim_after(timestamptz,integer)','execute') then raise exception 'F90_MAIL_RPC_PERMISSION';end if;
 select jsonb_agg(to_jsonb(q) order by id) into before_queue from f90_private.deposit_email_queue q;
 if exists(select 1 from f90_private.deposit_email_queue where created_at>=cutoff) then raise exception 'F90_UNREVIEWED_NEW_QUEUE';end if;
 select id into deposit from public.f90_deposits order by created_at limit 1;
 if deposit is null then raise exception 'F90_FIXTURE_DEPOSIT_REQUIRED';end if;
 insert into f90_private.deposit_email_queue(deposit_id,recipient,event_type,status,created_at,attempt_count) values(deposit,'cutoff-test-'||gen_random_uuid()||'@example.invalid','deposit_submitted','pending',cutoff,0) returning id into test_id;
 select count(*) into claimed from public.f90_mail_claim_after(cutoff,10) where job_id=test_id;
 if claimed<>1 or (select status from f90_private.deposit_email_queue where id=test_id)<>'sending' then raise exception 'F90_NEW_MAIL_NOT_CLAIMED';end if;
 if before_queue is distinct from (select jsonb_agg(to_jsonb(q) order by id) from f90_private.deposit_email_queue q where id<>test_id) then raise exception 'F90_HISTORICAL_MAIL_CLAIMED';end if;
 select count(*) into reclaimed from public.f90_mail_claim_after(cutoff,10);
 if reclaimed<>0 then raise exception 'F90_MAIL_DUPLICATE_CLAIM';end if;
 begin perform public.f90_mail_claim_after(null,10);raise exception 'Null cutoff accepted';exception when invalid_parameter_value then null;end;
 begin perform public.f90_mail_claim_after(timestamptz '2026-10-18T00:00:00Z',10);raise exception 'Old cutoff accepted';exception when invalid_parameter_value then null;end;
 begin perform public.f90_mail_claim_after(now()+interval '2 minutes',10);raise exception 'Future cutoff accepted';exception when invalid_parameter_value then null;end;
end $f90$;
select jsonb_build_object('service_only',true,'new_job_claimed',true,'historic_jobs_unchanged',true,'duplicate_claim_blocked',true,'invalid_cutoffs_rejected',true,'email_sent',false,'transaction','ROLLBACK ONLY') as tests;
rollback;