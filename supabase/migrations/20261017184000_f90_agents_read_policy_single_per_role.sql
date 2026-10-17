-- Keep exactly the same agent-directory visibility with a single SELECT policy per role.
-- Before: anon => active; authenticated => active OR manager/admin.
-- After:  anon => active; authenticated => active OR manager/admin.
-- Does not touch records, balances, pricing, payment operations or provider settings.
begin;
drop policy if exists f90_agents_public_read on public.f90_store_agents;
drop policy if exists f90_agents_staff_read on public.f90_store_agents;
create policy f90_agents_public_read on public.f90_store_agents
  for select to anon using (is_active);
create policy f90_agents_authenticated_read on public.f90_store_agents
  for select to authenticated
  using (is_active or ((select f90_private.my_role()) in ('manager', 'admin')));
commit;
