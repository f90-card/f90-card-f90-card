-- Extend the existing PRIVATE F90 radio bucket to accept common mobile audio.
-- Original file privacy policies, size limits and old uploads remain unchanged.
UPDATE storage.buckets
SET allowed_mime_types=ARRAY[
  'audio/mpeg','audio/ogg','audio/wav','audio/mp4','audio/aac',
  'video/mp4','video/webm'
]::text[]
WHERE id='f90-radio' AND public=false;
