alter table public.f90_providers drop constraint if exists f90_providers_adapter_check;
alter table public.f90_providers add constraint f90_providers_adapter_check check (adapter in ('smm','json','omega','rest'));
update public.f90_providers set adapter='omega', currency='USD', is_enabled=false
where id='aba53c0a-df42-40b1-b4e6-efacaecfc829' and endpoint='https://api.mr-omegastore.shop';
