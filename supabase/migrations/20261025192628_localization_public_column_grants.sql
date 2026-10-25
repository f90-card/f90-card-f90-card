REVOKE SELECT ON public.f90_i18n_text FROM anon,authenticated;
GRANT SELECT(source_text,en,fr,pt,updated_at) ON public.f90_i18n_text TO anon,authenticated;
