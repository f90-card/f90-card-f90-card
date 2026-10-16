-- Owner-defined Xena Live salary payout rates for each account currency.
-- Preserves all existing payout request snapshots and USD wallet ledger balances.
-- Rate per 100,000 coins: USD 10, JOD 7, ILS 3.25.
WITH updated_options AS (
  SELECT COALESCE(jsonb_agg(
    CASE WHEN opt->>'currency' IN ('USD','ILS','JOD') THEN
      opt || jsonb_build_object(
        'per_100k',CASE opt->>'currency'
          WHEN 'USD' THEN 10::numeric
          WHEN 'JOD' THEN 7::numeric
          WHEN 'ILS' THEN 3.25::numeric END,
        'units_per_usd',(SELECT r.per_usd FROM public.f90_rates r
          WHERE r.currency=opt->>'currency' AND r.is_enabled AND r.per_usd>0 LIMIT 1))
    ELSE opt END ORDER BY n
  ),'[]'::jsonb) AS options
  FROM public.site_settings s,
    LATERAL jsonb_array_elements(s.config->'salary_withdrawal'->'payout_options')
      WITH ORDINALITY t(opt,n)
  WHERE s.id=1
)
UPDATE public.site_settings s
SET config=jsonb_set(s.config,'{salary_withdrawal,payout_options}',o.options,true),
    updated_at=now()
FROM updated_options o
WHERE s.id=1
  AND jsonb_array_length(o.options)=3
  AND (SELECT count(*) FROM public.f90_rates
    WHERE currency IN ('USD','ILS','JOD') AND is_enabled AND per_usd>0)=3;
