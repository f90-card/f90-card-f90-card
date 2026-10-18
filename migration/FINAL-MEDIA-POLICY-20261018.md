# F90 CARD — approved one-time media sources (2026-10-18)

The store owner clarified: **DO NOT mirror the old supplier/category/product promotional-image library.**

- Keep the existing F90 original logo, static brand files, and banners (4 currently in original public Supabase bucket plus 3 existing GitHub banner URLs).
- New official icons are fetched once from pre-approved existing Google Play / Apple App Store CDN URLs, plus carefully matched Apple App Store listings for selected clearly identified apps.
- **No** private identities, deposit receipts, full old image library, radio, music, or unrelated media.
- Build script: `migration/build-official-assets.mjs`; source manifest `migration/official-assets-manifest.json`, curated official searches `migration/verified-app-searches.json`.
- Script refuses unexpected hosts, wrong MIME, oversized media, unsupported paths, and ambiguous app store matches. Unverifiable apps remain unmodified until reviewed.
- Public output index: `https://f90-card-media.pages.dev/official-index.json`, listing confirmed downloaded icons, their category/product IDs, and missing matches, **after deployment succeeds**.
- Files use immutable SHA-256 URL suffixes, so manual replacements produce a new URL and can be updated deliberately.
- Only change the **new** Supabase staging catalog after checking live Cloudflare build results. Never overwrite manually adjusted prices, stock, supplier mapping, display ordering, or original production images.
- Site and commercial backend cutover is a separate decision. **Auth remains incomplete in staging; DO NOT change DNS or point customers there yet.**
