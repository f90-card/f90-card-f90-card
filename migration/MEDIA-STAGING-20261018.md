# F90 CARD: Cloudflare public media staging

- Cloudflare Pages project: `f90-card-media` (media-only, **no checkout, login, or financial operations**)
- Production branch: `migration/cloudflare-supabase-20261018`
- Build: `node migration/build-public-media.mjs`
- Output: `dist-f90-media/`
- Public image inventory: `migration/public-media-manifest.json` with 616 objects under public `f90-images` only.
- First build deliberately copies **25** images (F90_MEDIA_LIMIT=25 default). One-time bandwidth test before a full transfer.
- URLs when deployment succeeds: `https://f90-card-media.pages.dev/media/f90-images/<original-public-image-path>`
- This is a **snapshot**, not an admin media upload system; changes made after the snapshot require a subsequent rebuild or a proper object-storage upload system.
- All source files were below the Cloudflare Pages maximum asset size of 25 MiB at snapshot.
- Private buckets (`f90-identity`, `f90-receipts`) are excluded.
- `f90-radio`, `f90-audio`, `f90-videos`, and unused marketing media are excluded from this test build.
- No permanent URL rewriting in production is authorized yet. Database image URLs remain untouched.
- R2 was unavailable via API (10042, enable through Cloudflare Dashboard). Pages static assets are a no-R2 staging alternative for public images and their CDN traffic, subject to build/file quotas.
- Nothing under `main` or `www.f90card.online` is changed by this media project.

## Verification gates
1. Check deployed `manifest.json` returns `image_count=25`.
2. Check at least 2 returned public image links and their MIME.
3. Compare successfully mirrored byte lengths with source metadata.
4. Increase `F90_MEDIA_LIMIT` in a controlled way only after success and confirming monthly source egress remains available.
5. On cutover, rewrite only verified public asset URLs in the NEW database, preserving any manually chosen external app icons and pricing overrides.
