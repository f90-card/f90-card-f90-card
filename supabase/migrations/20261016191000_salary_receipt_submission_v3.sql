-- F90 Xena salary receipt extension. Existing requests and review flow stay intact.
alter table public.f90_salary_requests
  add column if not exists client_note text not null default '',
  add column if not exists receipt_path text not null default '';

CREATE OR REPLACE FUNCTION public.f90_submit_salary_v3(p_account text, p_coins bigint, p_currency text, p_key uuid, p_note text, p_receipt text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_config jsonb;
  v_salary jsonb;
  v_option jsonb;
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_account text := trim(coalesce(p_account, ''));
  v_note text := trim(coalesce(p_note, ''));
  v_receipt text := trim(coalesce(p_receipt, ''));
  v_min bigint;
  v_rate numeric;
  v_per_usd numeric;
  v_payout numeric;
  v_usd numeric;
  v_details text;
  v_row public.f90_salary_requests%rowtype;
begin
  if v_user is null then raise exception 'F90_LOGIN_REQUIRED'; end if;
  if p_key is null then raise exception 'F90_IDEMPOTENCY_KEY'; end if;
  if length(v_note)>1200 then raise exception 'F90_SALARY_NOTE'; end if;
  if p_coins is null or p_coins<100000 or p_coins>1000000000000 then
    raise exception 'F90_SALARY_AMOUNT';
  end if;
  if char_length(v_account)<2 or char_length(v_account)>120 then
    raise exception 'F90_SALARY_ACCOUNT';
  end if;
  if v_currency !~ '^[A-Z]{3,8}$' then raise exception 'F90_SALARY_CURRENCY'; end if;
  if v_receipt !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
     or split_part(v_receipt,'/',1) <> v_user::text then
    raise exception 'F90_SALARY_RECEIPT';
  end if;
  if not exists(select 1 from storage.objects
    where bucket_id='f90-receipts' and name=v_receipt) then
    raise exception 'F90_SALARY_RECEIPT_MISSING';
  end if;
  if not exists(select 1 from public.profiles
    where id=v_user and is_verified and account_status='active') then
    raise exception 'F90_VERIFICATION_REQUIRED';
  end if;
  select * into v_row from public.f90_salary_requests
    where user_id=v_user and idempotency_key=p_key;
  if found then
    if v_row.account_id<>v_account or v_row.coins<>p_coins
       or v_row.payout_currency<>v_currency
       or v_row.receipt_path<>v_receipt
       or v_row.client_note<>v_note then
      raise exception 'F90_IDEMPOTENCY_CONFLICT';
    end if;
    return to_jsonb(v_row);
  end if;
  select config into v_config from public.site_settings where id=1;
  v_salary:=v_config->'salary_withdrawal';
  if coalesce((v_salary->>'enabled')::boolean,false)=false then
    raise exception 'F90_SALARY_DISABLED';
  end if;
  v_min:=greatest(100000,coalesce((v_salary->>'minimum_coins')::bigint,100000));
  if p_coins<v_min then raise exception 'F90_SALARY_MINIMUM'; end if;
  if not exists(select 1 from public.f90_rates
    where currency=v_currency and is_enabled and per_usd>0) then
    raise exception 'F90_SALARY_CURRENCY_DISABLED';
  end if;
  select item into v_option
    from jsonb_array_elements(case when jsonb_typeof(v_salary->'payout_options')='array'
      then v_salary->'payout_options' else '[]'::jsonb end) as item
    where item->>'currency'=v_currency and item->>'enabled'='true' limit 1;
  if v_option is null then raise exception 'F90_SALARY_CURRENCY_DISABLED'; end if;
  begin
    v_rate:=(v_option->>'per_100k')::numeric;
    v_per_usd:=(v_option->>'units_per_usd')::numeric;
  exception when others then
    raise exception 'F90_SALARY_RATE';
  end;
  if v_rate is null or v_rate<=0 or v_rate>1000000000000
     or v_per_usd is null or v_per_usd<=0 or v_per_usd>1000000000000 then
    raise exception 'F90_SALARY_RATE';
  end if;
  v_payout:=round((p_coins::numeric/100000)*v_rate,6);
  v_usd:=round(v_payout/v_per_usd,6);
  if v_usd<=0 or v_usd>100000000 then raise exception 'F90_SALARY_RATE'; end if;
  v_details:=left(coalesce(v_salary->>'details_ar',''),4000);
  insert into public.f90_salary_requests(
    user_id,account_id,coins,usd_amount,coins_per_usd,details_snapshot,
    payout_currency,payout_amount,payout_rate_per_100k,payout_units_per_usd,
    idempotency_key,client_note,receipt_path
  ) values (
    v_user,v_account,p_coins,v_usd,round(p_coins::numeric/v_usd,8),v_details,
    v_currency,v_payout,v_rate,v_per_usd,p_key,v_note,v_receipt
  ) returning * into v_row;
  return to_jsonb(v_row);
end
$function$

revoke all on function public.f90_submit_salary_v3(text,bigint,text,uuid,text,text) from public,anon;
grant execute on function public.f90_submit_salary_v3(text,bigint,text,uuid,text,text) to authenticated,service_role;
