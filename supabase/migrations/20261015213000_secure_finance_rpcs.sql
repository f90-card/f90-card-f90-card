-- Prevent overlapping financial request systems: only the dedicated, transactional salary/transfer
-- RPCs may handle money. The generic custom request table is for account/design/website inquiries.
alter table public.f90_special_requests
  add constraint f90_special_nonfinancial_only check(kind in ('account','design','website'));
-- A valid logged-in session is necessary even though each SECURITY DEFINER RPC also validates auth.uid().
revoke execute on function public.f90_submit_salary(text,bigint,uuid) from public,anon;
revoke execute on function public.f90_submit_transfer(text,text,numeric,uuid) from public,anon;
revoke execute on function public.f90_review_salary(uuid,boolean,text) from public,anon;
revoke execute on function public.f90_review_transfer(uuid,boolean,text) from public,anon;
revoke execute on function public.f90_list_salary() from public,anon;
revoke execute on function public.f90_list_transfers() from public,anon;
grant execute on function public.f90_submit_salary(text,bigint,uuid) to authenticated;
grant execute on function public.f90_submit_transfer(text,text,numeric,uuid) to authenticated;
grant execute on function public.f90_review_salary(uuid,boolean,text) to authenticated;
grant execute on function public.f90_review_transfer(uuid,boolean,text) to authenticated;
grant execute on function public.f90_list_salary() to authenticated;
grant execute on function public.f90_list_transfers() to authenticated;
