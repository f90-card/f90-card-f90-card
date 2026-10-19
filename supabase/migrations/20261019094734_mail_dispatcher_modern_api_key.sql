-- Credentials flow only inside the new Supabase project's Edge/Vault channel.
-- No credential values are returned, logged, or included in this migration.
create or replace function public.f90_mail_provision_dispatcher(p_bearer text,p_dispatch text) returns boolean language plpgsql security definer set search_path='' as $$
declare item record;total integer;existing text;
begin
 if (f90_private.cutover_readiness()->>'jobs_enabled')::integer<>0 then raise exception 'F90_JOBS_MUST_BE_INACTIVE';end if;
 if p_bearer is null or p_bearer!~ '^(eyJ[A-Za-z0-9_.-]{40,}|sb_publishable_[A-Za-z0-9_-]{20,})$' or coalesce(length(p_dispatch),0)<28 then raise exception 'F90_INVALID_CREDENTIALS';end if;
 perform pg_advisory_xact_lock(909009);
 for item in select 'f90_mail_bearer_jwt' as name,p_bearer as value union all select 'f90_mail_dispatch_secret',p_dispatch loop
 select count(*),max(decrypted_secret) into total,existing from vault.decrypted_secrets where name=item.name;
 if total=0 then perform vault.create_secret(item.value,item.name,'F90 internal mail dispatcher');
 elsif total<>1 or existing is distinct from item.value then raise exception 'F90_MAIL_CREDENTIAL_CONFLICT';end if;
 end loop;
 return true;
end;$$;
revoke all on function public.f90_mail_provision_dispatcher(text,text) from public,anon,authenticated;
grant execute on function public.f90_mail_provision_dispatcher(text,text) to service_role;

create or replace function f90_private.dispatch_pending_mail() returns void language plpgsql security definer set search_path='' as $$
declare api_key text; dispatcher text;
begin
 if not exists(select 1 from f90_private.deposit_email_queue where status in ('pending','failed') and attempt_count<8) then return;end if;
 select decrypted_secret into api_key from vault.decrypted_secrets where name='f90_mail_bearer_jwt' order by created_at desc limit 1;
 select decrypted_secret into dispatcher from vault.decrypted_secrets where name='f90_mail_dispatch_secret' order by created_at desc limit 1;
 if coalesce(length(api_key),0)<40 or coalesce(length(dispatcher),0)<28 then return;end if;
 perform net.http_post(url:='https://ogkipkavlywgwhtomoca.supabase.co/functions/v1/f90-deposit-mail',body:='{}'::jsonb,
 headers:=jsonb_build_object('apikey',api_key,'x-f90-dispatch-secret',dispatcher,'Content-Type','application/json'),timeout_milliseconds:=10000);
end;$$;
revoke all on function f90_private.dispatch_pending_mail() from public,anon,authenticated;
