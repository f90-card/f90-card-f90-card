-- Default storefront display is ILS, not supplier's 3.20 conversion.
-- Only targeted preference fields are altered; customer wallets, existing orders,
-- banners, uploaded device media, and any other current manager choices stay intact.
UPDATE public.site_settings SET
  currency='ILS',
  config=jsonb_set(
    jsonb_set(
      coalesce(config,'{}'::jsonb),
      '{default_display_currency}','"ILS"'::jsonb,true
    ),
    '{promo_video,link_url}','""'::jsonb,true
  )
WHERE id=1;
UPDATE public.site_settings SET
  config=jsonb_set(config,'{promo_video,laptop,link_url}','""'::jsonb,true)
WHERE id=1 AND jsonb_typeof(config->'promo_video'->'laptop')='object';
