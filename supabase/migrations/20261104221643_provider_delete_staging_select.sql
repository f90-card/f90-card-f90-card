-- DELETE ... WHERE provider_id requires SELECT on the predicate column too.
-- Private staging remains inaccessible to browser roles.
grant select on f90_private.smm_source to service_role;
