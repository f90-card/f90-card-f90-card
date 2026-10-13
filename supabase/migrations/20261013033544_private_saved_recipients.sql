create table if not exists public.f90_saved_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('account_id', 'phone')),
  label text not null check (char_length(label) between 1 and 50),
  value text not null check (char_length(value) between 2 and 120),
  created_at timestamptz not null default now()
);

create index if not exists f90_saved_recipients_user_created_idx
  on public.f90_saved_recipients (user_id, created_at desc);

alter table public.f90_saved_recipients enable row level security;
revoke all on table public.f90_saved_recipients from public, anon, authenticated;
grant select, insert, update, delete on table public.f90_saved_recipients to service_role;

comment on table public.f90_saved_recipients is
  'Private reusable game account IDs and phone numbers; access only through the authenticated F90 platform function.';
