-- Customers may ask for a cancellation or raise an objection. Neither action
-- changes the order, contacts the supplier, or refunds a wallet automatically.
create table if not exists public.f90_order_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.f90_orders(id),
  user_id uuid not null references auth.users(id),
  kind text not null check (kind in ('cancel','dispute')),
  reason text not null check (length(trim(reason)) between 5 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists f90_order_requests_pending_unique
  on public.f90_order_requests(order_id,kind) where status='pending';
create index if not exists f90_order_requests_queue
  on public.f90_order_requests(status,created_at desc);
alter table public.f90_order_requests enable row level security;
revoke all on public.f90_order_requests from public,anon,authenticated;
grant select,insert,update on public.f90_order_requests to service_role;
