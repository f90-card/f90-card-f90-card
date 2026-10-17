-- Nonfinancial, optional recipient metadata sync with safe retry limits.
-- No changes to order status, price, balances, supplier settings, or purchase RPC.
alter table public.f90_orders
  add column if not exists supplier_name_checked_at timestamptz,
  add column if not exists supplier_name_check_attempts integer not null default 0
    check (supplier_name_check_attempts between 0 and 20);

create index if not exists f90_orders_supplier_name_backfill_idx
  on public.f90_orders (supplier_name_checked_at, created_at desc)
  where status='completed' and supplier_account_name is null
    and provider_order_id is not null and supplier_name_check_attempts < 3;

comment on column public.f90_orders.supplier_name_checked_at is
  'When supplier completed-order metadata was read-only checked for recipient name.';
comment on column public.f90_orders.supplier_name_check_attempts is
  'Bounded background name-only lookups. Never retransmit/recharge an order.';
