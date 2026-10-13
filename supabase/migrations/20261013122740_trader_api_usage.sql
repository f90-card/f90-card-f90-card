create table if not exists public.f90_api_usage (
  id bigint generated always as identity primary key,
  key_id uuid references public.f90_api_keys(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (char_length(action) between 1 and 80),
  http_status integer not null check (http_status between 100 and 599),
  created_at timestamptz not null default now()
);
create index if not exists f90_api_usage_key_created_idx
  on public.f90_api_usage (key_id, created_at desc);
create index if not exists f90_api_usage_user_created_idx
  on public.f90_api_usage (user_id, created_at desc);
alter table public.f90_api_usage enable row level security;
revoke all on public.f90_api_usage from anon, authenticated;
revoke all on sequence public.f90_api_usage_id_seq from anon, authenticated;
