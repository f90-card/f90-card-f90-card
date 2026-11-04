-- Change stored function code only. This migration does not remove any data.
-- Preserve all authorization, active-order checks and the safeupdate guard.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.f90_archive_provider(uuid,uuid)'::regprocedure) into definition;
 if position('delete from f90_private.shihab_catalog_source;' in definition)=0 then
   raise exception 'Unexpected provider deletion function; review before changing';
 end if;
 definition:=replace(definition,
   'delete from f90_private.shihab_catalog_source;',
   'delete from f90_private.shihab_catalog_source where provider_service=any(array(select cache.provider_service from f90_private.shihab_catalog_source cache));');
 execute definition;
end $$;
