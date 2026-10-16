-- Non-destructive login/financial table performance fixes.
-- Preserve all existing access scopes, rows, pricing and ledger data.
CREATE INDEX IF NOT EXISTS f90_salary_reviewed_by_idx
  ON public.f90_salary_requests (reviewed_by)
  WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS f90_transfer_reviewed_by_idx
  ON public.f90_transfer_requests (reviewed_by)
  WHERE reviewed_by IS NOT NULL;
ALTER POLICY f90_salary_self_read ON public.f90_salary_requests
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY f90_salary_manager_read ON public.f90_salary_requests
  USING (EXISTS (
    SELECT 1 FROM public.f90_user_roles r
    WHERE r.user_id=(SELECT auth.uid())
      AND r.role = ANY (ARRAY['manager'::text,'admin'::text])
  ));
ALTER POLICY f90_transfer_self_read ON public.f90_transfer_requests
  USING (user_id = (SELECT auth.uid()));