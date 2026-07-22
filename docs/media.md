# Tenant-safe media

Laravel is the authorization authority and system of record. Every asset, variant, usage, generation, stock reference, brand kit, and WordPress mapping carries an organization ID. Route binding scopes records to the signed-in user's current organization; clients never choose that organization ID.

## Storage and upload lifecycle

Development can use the private `media` disk. Compose provides a private MinIO bucket at `http://localhost:9000` and console at `http://localhost:9001`; `minio-init` creates the bucket without anonymous access. Production uses `media-s3`. Object keys are random and organization-prefixed, never derived from filenames.

1. `POST /api/media/uploads` validates type, declared size, project ownership, and quotas, then creates `pending_upload` and returns a short-lived constrained upload URL.
2. The browser uploads directly without receiving credentials.
3. Completion verifies existence, sniffs MIME, decodes dimensions, enforces byte and pixel limits, and calculates SHA-256. Browser confirmation never marks an asset ready.
4. The worker advances scanning and processing, normalizes orientation, strips EXIF/GPS, optimizes, and creates idempotent variants. Rejected data is never served inline.

SVG and animated GIF are rejected initially. Originals stay private. Dashboard URLs expire; blueprints store `{ assetId, variant, altText, focalPoint, decorative }`, never those URLs.

## Processing and variants

Configured variants are thumbnail (320), small (640), medium (1024), large (1600), hero (1920), social (1200×630 crop), and square (1080 crop). Workers must not upscale, must use bounded temporary files, distributed operation locks, deterministic transformation hashes, and cleanup in `finally`. WebP is default and AVIF is opt-in.

## Generation, stock, and licensing

Only workers call image providers. Provider URLs are accepted only from configured HTTPS hosts and are immediately copied to application storage. Content-policy failures are safe, audited, and are not retried. Stock imports retain provider/photographer/source attribution and never hotlink deployed images. Retries of one generation job use the same quota reservation; a user-requested new generation consumes another unit.

## Revisions and deployment

Revision validation resolves every stable reference against its organization/project and requires `ready`. Usage rows are rebuilt when references change. Approved revision usage blocks deletion. Deployment resolves only the exact pinned revision, chooses a suitable variant, verifies previewed checksums, and reuses `WordPressMediaMapping` records by connection/asset/variant. Changed checksums require another preview.

## Operations

- Start processors with `pnpm --filter @website-generator/worker dev` and Laravel queue workers with `php artisan queue:work`.
- Inspect MinIO through its console or `mc ls local/website-generator-media`.
- Test uploads through `/dashboard/media`; the grid uses lazy thumbnails rather than originals.
- Run cleanup as a dry run first: `php artisan media:cleanup --dry-run`. Retained or approved media must not be removed.
- Verify configuration with `docker compose config` and storage with `php artisan media:verify-storage`.

Never log signed URLs, credentials, full provider responses, or binary content. Storage usage includes all retained application-owned originals and derivatives.
