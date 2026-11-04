-- Safe fixtures only: no HTTP, no checkout, no committed deletion.
begin;
do $$
declare m uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid();
 other uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); sibling uuid:=gen_random_uuid();
 o uuid:=gen_random_uuid(); shared uuid; state text; fingerprint text; result boolean;
begin
 select md5(coalesce(string_agg(to_jsonb(w)::text,'' order by user_id),'')) into fingerprint from public.f90_wallets w;
 insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 (m,'delete-manager-'||m||'@example.invalid','{}','{}'),
 (u,'delete-customer-'||u||'@example.invalid','{}','{}');
 update public.f90_user_roles set role='manager' where user_id=m;
 shared:=vault.create_secret('isolated-test-value','delete-test-'||v);
 insert into public.f90_providers(id,name,endpoint,secret_id) values
 (v,'Isolated supplier delete test','https://example.invalid',shared),
 (other,'Isolated retained supplier','https://example.invalid',shared);
 insert into public.products(id,slug,name,price,currency,is_active) values
 (p,'delete-test-'||p,'Delete fixture',1,'USD',false),
 (sibling,'delete-test-'||sibling,'Keep fixture',1,'USD',false);
 insert into public.f90_product_internal(product_id,provider_id,provider_service) values
 (p,v,'fixture-1'),(sibling,other,'fixture-1');
 insert into f90_private.smm_source(provider_id,service_id,payload) values(v,'fixture-1','{}'),(other,'fixture-1','{}');
 insert into public.f90_orders(id,order_number,user_id,product_id,product_name,quantity,unit_quantity,
 subtotal_usd,total_usd,fulfillment,status,provider_id,provider_service,provider_order_id,idempotency_key) overriding system value
 values(o,-(random()*1000000000000000)::bigint-1,u,p,'Preserved product name',1,1,1,1,'automatic','processing',v,'fixture-1','supplier-reference','delete-fixture-'||o);
 begin
  perform public.f90_archive_provider(u,v);
  raise exception 'Unauthorized delete accepted';
 exception when others then if sqlerrm<>'F90_FORBIDDEN' then raise; end if; end;
 foreach state in array array['pending','queued','submitting','processing','review'] loop
  update public.f90_orders set status=state where id=o;
  begin
   perform public.f90_archive_provider(m,v);
   raise exception 'Active order delete accepted';
  exception when others then if sqlerrm<>'F90_PROVIDER_ACTIVE_ORDERS' then raise; end if; end;
  if not exists(select 1 from public.products where id=p) or not exists(select 1 from public.f90_providers where id=v)
   then raise exception 'Blocked delete partially mutated catalog'; end if;
 end loop;
 update public.f90_orders set status='completed' where id=o;
 result:=public.f90_archive_provider(m,v);
 if not result or exists(select 1 from public.f90_providers where id=v)
 or exists(select 1 from public.products where id=p)
 or exists(select 1 from public.f90_product_internal where provider_id=v)
 or exists(select 1 from f90_private.smm_source where provider_id=v)
 then raise exception 'Incomplete deletion'; end if;
 if not exists(select 1 from public.f90_orders where id=o and provider_id is null and product_id is null
  and status='completed' and total_usd=1 and refunded_usd=0 and product_name='Preserved product name'
  and provider_order_id='supplier-reference' and provider_service='fixture-1'
  and deleted_provider_snapshot->>'id'=v::text and deleted_provider_snapshot->>'name'='Isolated supplier delete test'
  and not(deleted_provider_snapshot ? 'secret_id')) then raise exception 'Historical order damaged'; end if;
 if not exists(select 1 from public.products where id=sibling)
 or not exists(select 1 from f90_private.smm_source where provider_id=other)
 or not exists(select 1 from vault.secrets where id=shared) then raise exception 'Other supplier damaged'; end if;
 perform public.f90_archive_provider(m,v); -- retry must be harmless
 perform public.f90_archive_provider(m,other);
 if exists(select 1 from vault.secrets where id=shared) then raise exception 'Unreferenced credential retained'; end if;
 if (select md5(coalesce(string_agg(to_jsonb(w)::text,'' order by user_id),'')) from public.f90_wallets w where user_id not in(m,u))<>fingerprint
 then raise exception 'Existing wallet changed'; end if;
 if has_function_privilege('anon','public.f90_archive_provider(uuid,uuid)','execute')
 or has_function_privilege('authenticated','public.f90_archive_provider(uuid,uuid)','execute')
 or not has_function_privilege('service_role','public.f90_archive_provider(uuid,uuid)','execute') then raise exception 'Unsafe permissions'; end if;
end $$;
select 'PASS: authorization, all active states blocked, full deletion, order snapshots, other supplier/shared credentials, retries, balances and RPC grants; ROLLBACK' result;
rollback;
