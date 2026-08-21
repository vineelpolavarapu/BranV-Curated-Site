"""
One-shot backfill: rewrite product_images.url from R2's private S3 API endpoint
to the bucket's public URL.

Why this exists
--------------
Before `S3_PUBLIC_URL` existed, uploads built the stored URL from
`S3_ENDPOINT + S3_BUCKET`, i.e. `https://<account>.r2.cloudflarestorage.com/branv-uploads/...`.
That is R2's *private* S3 API endpoint and is not anonymously readable, so every
storefront product image 404'd in the browser and the frontend fell back to a
hardcoded Unsplash image.

The object itself IS in R2 (put_object ran in production); only the *host* in the
stored URL is wrong. The object key path is identical on both surfaces, so swapping
the host base fixes every existing row without re-uploading anything:

    https://<account>.r2.cloudflarestorage.com/branv-uploads/products/avatars/x.png
    -> https://pub-<id>.r2.dev/products/avatars/x.png

What it does
------------
1. Computes ``old_base = S3_ENDPOINT/S3_BUCKET`` and ``new_base = S3_PUBLIC_URL``.
2. ``UPDATE product_images SET url = REPLACE(url, :old, :new)
   WHERE url LIKE (:old || '%')``  -- parameterised, no string interpolation.
3. Reports how many rows changed, plus any leftover rows that still start with
   ``/uploads/`` (dev-local files that were never stored in R2 - those products
   must be re-uploaded manually; the script will NOT touch them).

Idempotent: a second run is a no-op because no rows match ``old_base`` after the
first (assuming ``old_base != new_base``).

Usage (on the VM, against prod Postgres):
    cd apps/api
    uv run python scripts/backfill_image_urls.py            # dry-run, reports only
    uv run python scripts/backfill_image_urls.py --apply    # actually rewrite

Requires ``S3_PUBLIC_URL`` to be set in the environment (deploy/.env). Exits
non-zero if it is unset or equals the derived private base.
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


async def run(apply: bool) -> int:
    s = get_settings()
    if not s.S3_PUBLIC_URL:
        print("ERROR: S3_PUBLIC_URL is not set. Set it in the environment first.")
        return 2

    old_base = (s.S3_ENDPOINT or "").rstrip("/") + f"/{s.S3_BUCKET}"
    new_base = s.S3_PUBLIC_URL.rstrip("/")

    if old_base == new_base:
        print(f"ERROR: S3_PUBLIC_URL equals the derived private base ({new_base}).")
        print("       Set S3_PUBLIC_URL to the bucket's PUBLIC r2.dev/custom-domain URL.")
        return 2

    print(f"old_base (private S3 API): {old_base}")
    print(f"new_base (public):         {new_base}")
    print(f"mode: {'APPLY' if apply else 'DRY-RUN (pass --apply to write)'}")
    print()

    db_session._ensure_engine()
    assert db_session._SessionLocal is not None

    async with db_session._SessionLocal() as session:  # type: AsyncSession
        # Count rows that currently use the old private base.
        match_count = (
            await session.execute(
                text("SELECT COUNT(*) FROM product_images WHERE \"url\" LIKE :pat"),
                {"pat": f"{old_base}%"},
            )
        ).scalar_one()
        print(f"rows matching old base: {match_count}")

        # Rows that are dev-local and never reached R2 - cannot be fixed by a host swap.
        local_count = (
            await session.execute(
                text("SELECT COUNT(*) FROM product_images WHERE \"url\" LIKE '/uploads/%'"),
            )
        ).scalar_one()
        if local_count:
            print(f"rows on /uploads/ (dev-local, NOT in R2 - re-upload manually): {local_count}")

        if not apply:
            print("\nDry-run complete. No rows written.")
            return 0

        if match_count == 0:
            print("\nNothing to update. Already backfilled.")
            return 0

        result = await session.execute(
            text(
                "UPDATE product_images "
                "SET \"url\" = REPLACE(\"url\", :old, :new) "
                "WHERE \"url\" LIKE :pat"
            ),
            {"old": old_base, "new": new_base, "pat": f"{old_base}%"},
        )
        await session.commit()
        print(f"\nUpdated {result.rowcount} row(s).")
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually rewrite rows. Without it, runs as a dry-run report.",
    )
    args = parser.parse_args()
    return asyncio.run(run(apply=args.apply))


if __name__ == "__main__":
    raise SystemExit(main())