"""
One-shot backfill: mirror existing remote (retailer-CDN) product image URLs into
our own R2 bucket, then rewrite the stored URL to the R2 public URL.

Why this exists
--------------
Historically, scraped/pasted retailer image URLs were stored verbatim in
``product_images.url``. Retailer CDNs enforce hotlink/referer protection, region
locking, and signed-URL expiry, so those rows break on the public storefront (the
frontend then falls back to a generic Unsplash image). New saves now re-host images
on R2 automatically via ``_rehost_image_urls`` / ``s3.ingest_remote_image``; this
script fixes the rows that predate that change.

What it does
------------
1. Selects ``product_images`` rows whose ``url`` is NOT already one of ours
   (``s3.key_from_url`` returns None) and is a remote ``http(s)`` URL (skips
   dev-local ``/uploads/`` paths, blob/data previews).
2. For each, downloads the bytes and uploads to R2 via ``s3.ingest_remote_image``
   (content-addressed key → idempotent; a re-run re-hosts nothing already moved).
3. Rewrites the row's ``url`` to the returned R2 public URL. Rows that fail to
   ingest (dead link, non-image, blocked) are left untouched and reported.

Requires object storage to be configured (``S3_*`` set, ``USE_MOCK_INTEGRATIONS``
false) and ``S3_PUBLIC_URL`` pointing at the bucket's public surface.

Usage (on the VM, against prod Postgres):
    cd apps/api
    uv run python scripts/ingest_existing_remote_images.py            # dry-run report
    uv run python scripts/ingest_existing_remote_images.py --apply    # actually re-host
    uv run python scripts/ingest_existing_remote_images.py --apply --limit 50
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# Make `app` importable when run as a file (uv run python scripts/...).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.core.settings import get_settings
from app.db import session as db_session
from app.integrations import s3


async def run(apply: bool, limit: int | None) -> int:
    s = get_settings()
    configured = bool(s.S3_ACCESS_KEY and s.S3_SECRET_KEY and not s.USE_MOCK_INTEGRATIONS)
    if not configured:
        print("ERROR: object storage is not configured (need S3_* creds and "
              "USE_MOCK_INTEGRATIONS=false). Nothing to do.")
        return 2

    print(f"public base: {s3.public_base(s)}")
    print(f"mode: {'APPLY' if apply else 'DRY-RUN (pass --apply to write)'}")
    print()

    db_session._ensure_engine()
    assert db_session._SessionLocal is not None

    async with db_session._SessionLocal() as session:  # type: AsyncSession
        rows = (
            await session.execute(
                text('SELECT "id", "productId", "url" FROM product_images ORDER BY "createdAt"')
            )
        ).all()

        # Keep only rows that point at a remote, non-ours URL.
        targets = [
            (rid, pid, url)
            for (rid, pid, url) in rows
            if url
            and url.startswith(("http://", "https://"))
            and s3.key_from_url(s, url) is None
        ]
        if limit:
            targets = targets[:limit]

        print(f"total image rows: {len(rows)}")
        print(f"remote rows to re-host: {len(targets)}")
        if not apply:
            for rid, _pid, url in targets[:20]:
                print(f"  would re-host {rid}: {url[:100]}")
            if len(targets) > 20:
                print(f"  … and {len(targets) - 20} more")
            print("\nDry-run complete. No rows written.")
            return 0

        moved, failed = 0, 0
        for rid, pid, url in targets:
            new_url = await s3.ingest_remote_image(url, kind="product-image", ownerId=pid)
            if not new_url:
                failed += 1
                print(f"  FAIL {rid}: could not ingest {url[:100]}")
                continue
            await session.execute(
                text('UPDATE product_images SET "url" = :new WHERE "id" = :id'),
                {"new": new_url, "id": rid},
            )
            moved += 1
            print(f"  ok   {rid} -> {new_url}")
        await session.commit()
        print(f"\nDone. re-hosted={moved} failed={failed}")
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--apply", action="store_true",
                        help="Actually re-host + rewrite rows. Without it, dry-run report.")
    parser.add_argument("--limit", type=int, default=None,
                        help="Cap the number of rows processed (useful for a first pass).")
    args = parser.parse_args()
    return asyncio.run(run(apply=args.apply, limit=args.limit))


if __name__ == "__main__":
    raise SystemExit(main())
