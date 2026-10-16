-- Corrected owner rate for new Xena requests; historical request prices stay immutable.
UPDATE public.site_settings
SET config=jsonb_set(config,'{salary_withdrawal,payout_options}',
  (SELECT jsonb_agg(
    CASE WHEN x->>'currency'='ILS'
      THEN jsonb_set(x,'{per_100k}','32.5'::jsonb,true)
      ELSE x END ORDER BY ord)
    FROM jsonb_array_elements(config->'salary_withdrawal'->'payout_options')
      WITH ORDINALITY v(x,ord)),true),
    updated_at=now()
WHERE id=1
AND EXISTS (SELECT 1 FROM jsonb_array_elements(config->'salary_withdrawal'->'payout_options') x
  WHERE x->>'currency'='ILS' AND (x->>'per_100k')::numeric<>32.5);
