-- Individual transfer method fees.
create or replace function public.f90_submit_transfer(p_method text,p_recipient text,p_net numeric,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_cfg jsonb; v_method jsonb; v_currency text; v_rate numeric; v_fee numeric;
 v_net_usd numeric; v_total numeric; v_balance numeric; v_row public.f90_transfer_requests%rowtype;
begin
 if v_user is null then raise exception 'F90_LOGIN_REQUIRED'; end if;
 if not exists(select 1 from public.profiles where id=v_user and is_verified and account_status='active') then raise exception 'F90_VERIFICATION_REQUIRED'; end if;
 select * into v_row from public.f90_transfer_requests where user_id=v_user and idempotency_key=p_key;
 if found then
  if v_row.method_id<>p_method or v_row.recipient_details<>trim(p_recipient) or v_row.target_amount<>p_net then raise exception 'F90_IDEMPOTENCY_CONFLICT'; end if;
  return to_jsonb(v_row);
 end if;
 select config->'money_transfer' into v_cfg from public.site_settings where id=1;
 if coalesce((v_cfg->>'enabled')::boolean,false)=false then raise exception 'F90_TRANSFER_DISABLED'; end if;
 select value into v_method from jsonb_array_elements(coalesce(v_cfg->'methods','[]'::jsonb)) value
  where value->>'id'=p_method and coalesce((value->>'enabled')::boolean,false) limit 1;
 if v_method is null then raise exception 'F90_TRANSFER_METHOD'; end if;
 v_currency:=upper(coalesce(nullif(v_method->>'currency',''),'USD'));
 select per_usd into v_rate from public.f90_rates where currency=v_currency and is_enabled and per_usd>0;
 if not found then raise exception 'F90_TRANSFER_RATE_UNAVAILABLE'; end if;
 if length(trim(p_recipient))<3 or length(trim(p_recipient))>2000 then raise exception 'F90_TRANSFER_RECIPIENT'; end if;
 if p_net<1 or p_net>100000000 or round(p_net,2)<>p_net then raise exception 'F90_TRANSFER_AMOUNT'; end if;
 v_fee:=coalesce((v_method->>'fee_percent')::numeric,(v_cfg->>'fee_percent')::numeric,2);
 if v_fee<0 or v_fee>30 then raise exception 'F90_TRANSFER_FEE'; end if;
 v_net_usd:=round(p_net/v_rate,6);
 v_total:=round(v_net_usd*(1+v_fee/100),6);
 if v_total<0.01 then raise exception 'F90_TRANSFER_AMOUNT'; end if;
 select balance_usd into v_balance from public.f90_wallets where user_id=v_user for update;
 if not found or v_balance<v_total then raise exception 'F90_INSUFFICIENT_BALANCE'; end if;
 update public.f90_wallets set balance_usd=v_balance-v_total,updated_at=now() where user_id=v_user;
 insert into public.f90_transfer_requests(user_id,method_id,method_name,recipient_details,net_usd,fee_percent,total_usd,
  target_currency,target_amount,target_per_usd,idempotency_key)
 values(v_user,p_method,left(v_method->>'name_ar',120),trim(p_recipient),v_net_usd,v_fee,v_total,
  v_currency,p_net,v_rate,p_key) returning * into v_row;
 insert into public.f90_wallet_ledger(user_id,amount_usd,balance_after,kind,reference_id,description,unique_key,actor_id)
 values(v_user,-v_total,v_balance-v_total,'purchase',v_row.id,'طلب تحويل '||v_row.method_name||' · صافي '||p_net||' '||v_currency||' · عمولة '||v_fee||'٪','transfer:'||v_row.id,v_user);
 return to_jsonb(v_row);
end $$;
revoke all on function public.f90_submit_transfer(text,text,numeric,uuid) from public;
grant execute on function public.f90_submit_transfer(text,text,numeric,uuid) to authenticated;
