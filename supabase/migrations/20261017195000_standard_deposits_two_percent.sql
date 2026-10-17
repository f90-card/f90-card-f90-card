-- Align FUTURE ordinary deposits with F90 CARD's 2% commission policy.
-- Only Bank of Palestine and Reflect had explicit 0%; all other normal methods already resolve to 2%.
-- Salary withdrawal is NOT an ordinary deposit and remains unchanged.
-- Existing deposit rows, exchange-rate snapshots, wallets and historical ledger are untouched.
DO $migration$
DECLARE
  updated_count int;
  config_row jsonb;
BEGIN
  SELECT config INTO config_row FROM public.site_settings WHERE id=1 FOR UPDATE;
  IF config_row IS NULL THEN RAISE EXCEPTION 'F90_SETTINGS_MISSING'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(config_row->'payment_methods') m
      WHERE m->>'id' IN ('bank-palestine','reflect')
        AND m->>'enabled'='true'
        AND m->>'deposit_fee_percent'='0'
        AND coalesce(m->>'is_salary_withdrawal','false')='false') <> 2
  THEN
    RAISE EXCEPTION 'F90_DEPOSIT_FEE_STATE_CHANGED: review before applying';
  END IF;
  UPDATE public.site_settings s SET config=jsonb_set(
    s.config,'{payment_methods}',
    (SELECT jsonb_agg(
       CASE WHEN m->>'id' IN ('bank-palestine','reflect')
            THEN jsonb_set(m,'{deposit_fee_percent}','2'::jsonb,true)
            ELSE m END ORDER BY ord)
     FROM jsonb_array_elements(s.config->'payment_methods') WITH ORDINALITY AS methods(m,ord)),
    true)
  WHERE s.id=1;
  GET DIAGNOSTICS updated_count=ROW_COUNT;
  IF updated_count <> 1 THEN RAISE EXCEPTION 'F90_SETTINGS_ROW_COUNT_CHANGED'; END IF;
END;
$migration$;
