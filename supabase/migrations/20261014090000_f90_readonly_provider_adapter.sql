-- Extend supported adapter names without modifying existing suppliers or orders.
ALTER TABLE public.f90_providers
  DROP CONSTRAINT IF EXISTS f90_providers_adapter_check;
ALTER TABLE public.f90_providers
  ADD CONSTRAINT f90_providers_adapter_check
  CHECK (adapter IN ('smm','json','omega','rest','yassen','f90'));
