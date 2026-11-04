-- The Edge Function uses service_role, not the migration owner's role.
-- Catalog staging is private; grant only the missing operation to the server.
-- Keep the manager check, SECURITY INVOKER and browser RPC restrictions intact.
grant delete on f90_private.smm_source to service_role;
grant delete on f90_private.shihab_catalog_source to service_role;
