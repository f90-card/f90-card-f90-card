-- Radio source names, URLs and paths must not be exposed with site_settings.
-- Only the server's service-role connection may read/write the active source.
CREATE TABLE IF NOT EXISTS public.f90_radio_sources (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id=1),
  media_path text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'audio' CHECK (mode IN ('audio','video')),
  direct_audio_url text NOT NULL DEFAULT '',
  youtube_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.f90_radio_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.f90_radio_sources FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.f90_radio_sources TO service_role;
INSERT INTO public.f90_radio_sources(id,media_path,mode,direct_audio_url,youtube_url)
SELECT 1,COALESCE(config->'music'->>'path',''),
 CASE WHEN config->'music'->>'mode'='video' THEN 'video' ELSE 'audio' END,
 COALESCE(config->'music'->>'audio_url',''),COALESCE(config->'music'->>'youtube_url','')
FROM public.site_settings WHERE id=1 ON CONFLICT(id) DO NOTHING;
UPDATE public.site_settings
SET config=jsonb_set(config,'{music}',
 (COALESCE(config->'music','{}'::jsonb) - 'path' - 'audio_url' - 'youtube_url'),true)
WHERE id=1 AND (config->'music' ?| ARRAY['path','audio_url','youtube_url']);
