ALTER TABLE public.f90_providers DROP CONSTRAINT f90_providers_adapter_check;
ALTER TABLE public.f90_providers ADD CONSTRAINT f90_providers_adapter_check
CHECK (adapter IN ('smm','json','omega','rest','yassen'));
