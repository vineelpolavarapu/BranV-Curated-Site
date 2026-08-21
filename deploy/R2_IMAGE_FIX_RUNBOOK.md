# Runbook — Fix storefront product images (load from R2, not the Unsplash fallback)

## What was wrong
Admin-uploaded product images were stored in R2 correctly, but the stored URL
pointed at R2's **private S3 API endpoint** (`<account>.r2.cloudflarestorage.com`),
which browsers can't read. The storefront image then 404'd and the frontend silently
fell back to a single hardcoded Unsplash photo — so every product showed the same
"seed" image.

## What changed in code
- New `S3_PUBLIC_URL` setting (`apps/api/app/core/settings.py`). When set, upload
  URLs are built as `{S3_PUBLIC_URL}/{key}` (the bucket's **public** surface) instead
  of `{S3_ENDPOINT}/{bucket}/{key}` (the private S3 API).
- `apps/api/app/integrations/s3.py` + `apps/api/app/api/v1/uploads.py` use it.
- R2 upload failures now raise an error instead of silently falling back to a local
  `/uploads/` URL (which also breaks on the deployed web).
- `deploy/docker-compose.yml` passes `S3_PUBLIC_URL` to the API container.
- `apps/api/scripts/backfill_image_urls.py` rewrites existing `product_images.url`
  rows from the private endpoint to the public URL (same object key — no re-upload).

## Steps to finish (only you can do these)

### 1. Enable R2 public access  *(Cloudflare dashboard — ~1 min)*
R2 → bucket `branv-uploads` → Settings → Public access → enable the **r2.dev**
subdomain (gives `https://pub-<id>.r2.dev`) **or** bind a custom domain
(e.g. `https://cdn.branv.in`). Copy that URL. Sanity check: open any existing
object in an incognito tab via that URL — it must return 200.

### 2. Set S3_PUBLIC_URL on the VM  *(Oracle VM — ~1 min)*
```sh
ssh <vm>
cd <OCI_DEPLOY_PATH>          # wherever deploy/.env lives
# Append / set:
echo 'S3_PUBLIC_URL=https://pub-<id>.r2.dev' >> deploy/.env   # or edit it in place
```
Use the exact URL from step 1, **no trailing slash**.

### 3. Deploy the code
Push `BranV-main` (triggers `ci.yml` → Vercel web, and `deploy-api.yml` → VM API):
```sh
git add apps/api/app/core/settings.py apps/api/app/integrations/s3.py \
        apps/api/app/api/v1/uploads.py apps/api/scripts/backfill_image_urls.py \
        deploy/docker-compose.yml deploy/.env.production.example \
        deploy/R2_IMAGE_FIX_RUNBOOK.md .env.example
git commit -m "fix: store product image URLs against R2 public surface (S3_PUBLIC_URL)"
git push origin BranV-main
```
On the VM after the API image is pulled:
```sh
cd <OCI_DEPLOY_PATH>
docker compose up -d api
```

### 4. Backfill existing product images  *(VM — ~30 sec, idempotent)*
```sh
docker compose exec api uv run python scripts/backfill_image_urls.py            # dry-run
docker compose exec api uv run python scripts/backfill_image_urls.py --apply     # write
```
It reports how many rows it rewrote and flags any `/uploads/` rows (dev-local
files never in R2 — re-upload those products' images in the admin).

### 5. Confirm
- In admin (`/admin/products/[id]`) upload a fresh image; the returned URL must
  start with your `S3_PUBLIC_URL` and load in an incognito tab.
- On `www.branv.in`, that product's card shows your exact image. DevTools →
  Network: image request is 200 from the R2 public host, no `onError` fallback.

## Why this is safe to deploy before steps 1–2 are done
With `S3_PUBLIC_URL` unset, the code falls back to the old behavior (build the URL
from `S3_ENDPOINT`+bucket) — i.e. no regression, images just stay as they are now.
The fix only takes effect once `S3_PUBLIC_URL` is set.