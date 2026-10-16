-- Equivalent owner-or-manager salary visibility in one permissive policy.
-- No client gains access beyond the previously allowed two-policy OR.
ALTER POLICY f90_salary_self_read ON public.f90_salary_requests
  USING (
    user_id=(SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.f90_user_roles r
      WHERE r.user_id=(SELECT auth.uid())
        AND r.role=ANY(ARRAY['manager'::text,'admin'::text])
    )
  );
DROP POLICY IF EXISTS f90_salary_manager_read ON public.f90_salary_requests;