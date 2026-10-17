-- F90 CARD public agents directory. This migration is additive and affects no
-- existing products, balances, provider settings or order/payment records.
create table if not exists public.f90_store_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  phone text not null check (char_length(btrim(phone)) between 7 and 32),
  location text not null check (char_length(btrim(location)) between 2 and 160),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists f90_store_agents_public_sort_idx
  on public.f90_store_agents (sort_order, created_at) where is_active;
alter table public.f90_store_agents enable row level security;

-- Anonymous visitors only see agents explicitly published by the owner.
create policy f90_agents_public_read on public.f90_store_agents
  for select to anon, authenticated using (is_active);

-- Restricted management; f90_private.my_role() verifies live sessions and MFA.
create policy f90_agents_staff_read on public.f90_store_agents
  for select to authenticated
  using ((select f90_private.my_role()) in ('manager', 'admin'));
create policy f90_agents_staff_insert on public.f90_store_agents
  for insert to authenticated
  with check ((select f90_private.my_role()) in ('manager', 'admin'));
create policy f90_agents_staff_update on public.f90_store_agents
  for update to authenticated
  using ((select f90_private.my_role()) in ('manager', 'admin'))
  with check ((select f90_private.my_role()) in ('manager', 'admin'));
create policy f90_agents_staff_delete on public.f90_store_agents
  for delete to authenticated
  using ((select f90_private.my_role()) in ('manager', 'admin'));

revoke all on public.f90_store_agents from public, anon, authenticated;
grant select on public.f90_store_agents to anon;
grant select, insert, update, delete on public.f90_store_agents to authenticated;
comment on table public.f90_store_agents is
  'Public-facing F90 CARD agents managed by authorized store staff. Only publish contact information with agent consent.';
