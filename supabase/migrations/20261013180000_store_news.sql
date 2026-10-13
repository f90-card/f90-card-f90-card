create table if not exists public.f90_store_news (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('new_service', 'price')),
  title_ar text not null,
  body_ar text not null,
  product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists f90_store_news_recent on public.f90_store_news(created_at desc);
alter table public.f90_store_news enable row level security;
revoke all on public.f90_store_news from anon, authenticated;
grant select, insert on public.f90_store_news to service_role;
grant usage, select on sequence public.f90_store_news_id_seq to service_role;

create or replace function f90_private.product_news()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    insert into public.f90_store_news(kind,title_ar,body_ar,product_id)
      values ('new_service','خدمة جديدة: ' || left(new.name, 160),
              'أضيفت إلى المتجر بسعر يبدأ من $' || new.price::text, new.id);
  elsif tg_op = 'UPDATE' and new.is_active and old.is_active
        and new.price is distinct from old.price then
    insert into public.f90_store_news(kind,title_ar,body_ar,product_id)
      values ('price','تحديث سعر: ' || left(new.name, 160),
              'السعر الجديد يبدأ من $' || new.price::text, new.id);
  end if;
  return new;
end $$;
drop trigger if exists f90_product_news on public.products;
create trigger f90_product_news after insert or update of is_active, price on public.products
for each row execute function f90_private.product_news();
