-- Align FUTURE ordinary deposits with F90 CARD's 2% commission policy.
-- Fix only Bank of Palestine and Reflect if still at 0%; skip if already 2%.
-- Salary withdrawal is NOT an ordinary deposit and remains unchanged.
-- Existing deposit rows, exchange-rate snapshots, wallets and historical ledger are untouched.
DO $migration$
DECLARE
  updated_count int;
  needs_change int;
  config_row jsonb;
BEGIN
  SELECT config INTO config_row FROM public.site_settings WHERE id=1 FOR UPDATE;
  IF config_row IS NULL THEN RAISE EXCEPTION 'F90_SETTINGS_MISSING'; END IF;
  -- A concurrent admin edit may have already set the intended 2%; in that case do nothing.
  -- Abort if either method is missing, inactive, salary-only, or has an unexpected fee.
  IF (SELECT count(*) FROM jsonb_array_elements(config_row->'payment_methods') m
      WHERE m->>'id' IN ('bank-palestine','reflect')
        AND m->>'enabled'='true'
        AND m->>'deposit_fee_percent' IN ('0','2')
        AND coalesce(m->>'is_salary_withdrawal','false')='false') <> 2
  THEN
    RAISE EXCEPTION 'F90_DEPOSIT_FEE_STATE_CHANGED: review before applying';
  END IF;
  SELECT count(*) INTO needs_change
    FROM jsonb_array_elements(config_row->'payment_methods') m
    WHERE m->>'id' IN ('bank-palestine','reflect') AND m->>'deposit_fee_percent'='0';
  IF needs_change > 0 THEN
    UPDATE public.site_settings s SET config=jsonb_set(
      s.config,'{payment_methods}',
      (SELECT jsonb_agg(
         CASE WHEN m->>'id' IN ('bank-palestine','reflect')
                  AND m->>'deposit_fee_percent'='0'
              THEN jsonb_set(m,'{deposit_fee_percent}','2'::jsonb,true)
              ELSE m END ORDER BY ord)
       FROM jsonb_array_elements(s.config->'payment_methods') WITH ORDINALITY AS methods(m,ord)),
      true)
    WHERE s.id=1;
    GET DIAGNOSTICS updated_count=ROW_COUNT;
    IF updated_count <> 1 THEN RAISE EXCEPTION 'F90_SETTINGS_ROW_COUNT_CHANGED'; END IF;
  END IF;
END;
$migration$;
