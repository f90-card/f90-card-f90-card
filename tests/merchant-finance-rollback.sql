-- Runs real target quote/checkout functions against ephemeral identities and product.
-- Always rolls back. Identity sequences may advance; no customer money or supplier call.
begin;
do $$
declare u uuid:=gen_random_uuid();p uuid:=gen_random_uuid();q jsonb;a jsonb;b jsonb;expected numeric;
begin
 -- Production-safe: fixture rows are uncommitted and invisible to other sessions.
 -- No worker/provider call occurs; the whole transaction is rolled back.
 insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values(u,'checkout-'||u||'@example.invalid','{"display_name":"Isolated checkout acceptance"}','{}');
 update public.f90_wallets set balance_usd=100 where user_id=u;
 insert into public.products(id,slug,name,price,currency,stock,is_active,commerce) values(p,'isolated-checkout-'||p,'Isolated checkout acceptance',10,'USD',2,true,'{"type":"fixed","fulfillment":"manual","prices":{"USD":10}}');
 q:=public.f90_quote(u,p,1,'');expected:=(q->>'total_usd')::numeric;
 begin
  perform public.f90_checkout(u,p,1,'{"account_id":"isolated-test"}','isolated-price-test',expected+1,'');
  raise exception 'Price mismatch accepted';
 exception when raise_exception then if sqlerrm<>'F90_PRICE_CHANGED' then raise;end if;end;
 begin
  perform public.f90_checkout(u,p,1,'{}','isolated-fields-test',expected,'');
  raise exception 'Missing required account accepted';
 exception when raise_exception then if sqlerrm<>'F90_ACCOUNT_ID' then raise;end if;end;
 a:=public.f90_checkout(u,p,1,'{"account_id":"isolated-test"}','isolated-checkout-test',expected,'');
 b:=public.f90_checkout(u,p,1,'{"account_id":"isolated-test"}','isolated-checkout-test',expected,'');
 if a->>'id'<>b->>'id' or (select count(*) from public.f90_orders where user_id=u)<>1 then raise exception 'Duplicate order';end if;
 if (select count(*) from public.f90_wallet_ledger where user_id=u)<>1 then raise exception 'Duplicate debit';end if;
 if (select balance_usd from public.f90_wallets where user_id=u)<>100-expected then raise exception 'Wrong wallet debit';end if;
 if (select stock from public.products where id=p)<>1 then raise exception 'Duplicate stock reservation';end if;
 if a->>'status'<>'pending' or a->>'fulfillment'<>'manual' or a->>'provider_order_id' is not null then raise exception 'Unexpected supplier dispatch';end if;
 update public.f90_wallets set balance_usd=0 where user_id=u;
 begin
  perform public.f90_checkout(u,p,1,'{"account_id":"isolated-test"}','isolated-balance-test',expected,'');
  raise exception 'Overdraft accepted';
 exception when raise_exception then if sqlerrm<>'F90_INSUFFICIENT_BALANCE' then raise;end if;end;
end;$$;
select jsonb_build_object('authoritative_quote',true,'price_mismatch_rejected',true,'required_account_rejected',true,'single_order_on_retry',true,'single_debit_on_retry',true,'single_stock_reservation',true,'insufficient_balance_rejected',true,'supplier_called',false,'transaction','ROLLBACK ONLY') as tests;
rollback;
