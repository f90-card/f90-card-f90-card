# Cloudflare Pages PWA manifest adapter

The storefront preview now has a Cloudflare Pages Function at `/api/manifest` to replace the original Vercel-only dynamic manifest endpoint. It reads the new project's publicly readable site settings with a public publishable key and returns a manifest. It does not contain supplier or customer secrets, does not grant checkout access, and provides a static fallback when Supabase is unavailable. All commercial flows remain disabled on preview.
