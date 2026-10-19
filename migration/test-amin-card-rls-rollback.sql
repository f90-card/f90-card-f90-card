begin;
create temporary table f90_partner_test_ids(a uuid,b uuid,space_a uuid,space_b uuid,session_a uuid);
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();sa uuid;sb uuid;
begin
 if (f90_private.cutover_readiness()->>'jobs_enabled')::int<>0 then raise exception 'Test requires inactive migration target';end if;
 insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values(a,'partner-'||a||'@example.invalid','{"display_name":"Isolated partner A"}','{}'),(b,'partner-'||b||'@example.invalid','{"display_name":"Isolated partner B"}','{}');
 update public.f90_user_roles set role='amin_card' where user_id in(a,b);
 select id into sa from public.f90_partner_spaces where owner_id=a;select id into sb from public.f90_partner_spaces where owner_id=b;
 if sa is null or sb is null then raise exception 'Role did not create isolated spaces';end if;
 insert into auth.sessions(id,user_id,not_after) values(sid,a,now()+interval '1 hour');
 insert into f90_partner_test_ids values(a,b,sa,sb,sid);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','session_id',sid,'aal','aal1')::text,true);
end;$$;
grant select on f90_partner_test_ids to authenticated;
set local role authenticated;
do $$
declare t record;changed integer;cid uuid:=gen_random_uuid();
begin
 select * into t from f90_partner_test_ids;
 if (select count(*) from public.f90_partner_spaces where id=t.space_a)<>1 or (select count(*) from public.f90_partner_spaces where id=t.space_b)<>0 then raise exception 'Draft privacy failed';end if;
 insert into public.f90_partner_categories(id,space_id,name) values(cid,t.space_a,'Isolated own category');
 begin
 insert into public.f90_partner_categories(space_id,name) values(t.space_b,'Forbidden cross-space category');raise exception 'Cross-space insert allowed';
 exception when insufficient_privilege then null;end;
 update public.f90_partner_spaces set name='Forbidden' where id=t.space_b;get diagnostics changed=row_count;if changed<>0 then raise exception 'Cross-space update allowed';end if;
 if (select count(*) from public.f90_wallets where user_id<>t.a)<>0 then raise exception 'Other wallets exposed';end if;
 if (public.f90_partner_usage(t.space_a)->>'limit_bytes')::bigint<>209715200 then raise exception 'Wrong quota';end if;
 begin
 perform public.f90_partner_usage(t.space_b);raise exception 'Other usage exposed';
 exception when raise_exception then if sqlerrm<>'F90_FORBIDDEN' then raise;end if;end;
end;$$;
reset role;
do $$ declare t record;begin
 select * into t from f90_partner_test_ids;
 if f90_private.partner_quota(t.space_b||'/'||gen_random_uuid()||'.png','{"size":1024}') then raise exception 'Cross-space upload allowed';end if;
 if f90_private.partner_quota(t.space_a||'/'||gen_random_uuid()||'.png','{"size":5242881}') then raise exception 'Oversize image allowed';end if;
 if not f90_private.partner_quota(t.space_a||'/'||gen_random_uuid()||'.png','{"size":5242880}') then raise exception 'Valid image rejected';end if;
end;$$;
select jsonb_build_object('own_management',true,'other_space_hidden',true,'cross_space_insert_blocked',true,'cross_space_update_blocked',true,'financial_data_isolated',true,'cross_space_upload_blocked',true,'image_5mb_cap',true,'quota_200mb',true,'transaction','ROLLBACK ONLY') as tests;
rollback;
