"""
S3 / MinIO presign - port of `apps/api/src/uploads/uploads.service.ts`.

The presign call is CPU-bound (HMAC + SHA256 over headers); use sync boto3 and
run it in a threadpool via FastAPI's default executor when called from async
routes. aioboto3 would work too but offers no real benefit for presign.

Folder layout, key format, and `expiresIn=600s` MUST match the Nest impl so
URLs already produced by Nest remain valid against the FastAPI service.
"""

from __future__ import annotations

import logging
import secrets
import string
from dataclasses import dataclass
from typing import Literal

import boto3
from botocore.client import Config

from ..core.settings import get_settings

logger = logging.getLogger(__name__)

UploadKind = Literal[
    "brand-logo",
    "brand-hero",
    "product-image",
    "product-avatar",
    "avatar-reference",
    "article-hero",
    "lookbook-image",
    "banner",
]

_PRESIGN_EXPIRES = 60 * 10  # 10 minutes - must match Nest

_FOLDER_MAP: dict[str, str] = {
    "brand-logo": "brands/logos",
    "brand-hero": "brands/heroes",
    "product-image": "products/retailer",
    "product-avatar": "products/avatars",
    "avatar-reference": "avatars/references",
    "article-hero": "articles/heroes",
    "lookbook-image": "lookbooks",
    "banner": "banners",
}


@dataclass(slots=True)
class PresignResult:
    uploadUrl: str
    publicUrl: str
    key: str
    expiresIn: int


def _nanoid(n: int = 16) -> str:
    # nanoid's default URL-safe alphabet (A-Za-z0-9_-).
    alphabet = string.ascii_letters + string.digits + "_-"
    return "".join(secrets.choice(alphabet) for _ in range(n))


def _client():
    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.S3_ENDPOINT,
        region_name=s.S3_REGION,
        aws_access_key_id=s.S3_ACCESS_KEY,
        aws_secret_access_key=s.S3_SECRET_KEY,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path" if s.S3_FORCE_PATH_STYLE else "auto"},
        ),
    )


def _build_key(kind: UploadKind, filename: str, ownerId: str | None) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    folder = _FOLDER_MAP[kind]
    owner_segment = f"{ownerId}/" if ownerId else ""
    return f"{folder}/{owner_segment}{_nanoid(16)}.{ext}"


def public_base(s) -> str:
    """Base URL browsers use to GET uploaded objects.

    Prefers the configured ``S3_PUBLIC_URL`` (R2 r2.dev subdomain / custom domain
    - the *public* surface). Falls back to ``S3_ENDPOINT`` + bucket, which is only
    correct when the S3 endpoint is itself publicly readable (local MinIO). For R2
    the S3 endpoint is the private S3 API and must NOT be used as a public URL, so
    ``S3_PUBLIC_URL`` must be set in production.
    """
    if s.S3_PUBLIC_URL:
        return s.S3_PUBLIC_URL.rstrip("/")
    return (s.S3_ENDPOINT or "").rstrip("/") + f"/{s.S3_BUCKET}"


def presign_upload(
    *,
    contentType: str,
    filename: str,
    kind: UploadKind,
    ownerId: str | None,
) -> PresignResult:
    s = get_settings()
    key = _build_key(kind, filename, ownerId)
    client = _client()
    upload_url = client.generate_presigned_url(
        ClientMethod="put_object",
        Params={"Bucket": s.S3_BUCKET, "Key": key, "ContentType": contentType},
        ExpiresIn=_PRESIGN_EXPIRES,
    )
    return PresignResult(
        uploadUrl=upload_url,
        publicUrl=f"{public_base(s)}/{key}",
        key=key,
        expiresIn=_PRESIGN_EXPIRES,
    )


def key_from_url(s, url: str | None) -> str | None:
    """Recover the S3/R2 object key from a stored public URL.

    Image rows persist the *public* URL (``public_base(s)/{key}``), not the key.
    To delete the underlying object we strip the public-base prefix back off.
    Returns ``None`` when the URL doesn't belong to our bucket (e.g. external
    Unsplash fallbacks, ``blob:``/``data:`` previews, or local ``/uploads/``
    paths) so those are safely skipped rather than mis-deleted.
    """
    if not url:
        return None
    base = public_base(s).rstrip("/") + "/"
    if not url.startswith(base):
        return None
    key = url[len(base):].split("?", 1)[0].strip("/")
    return key or None


def delete_objects(keys: list[str]) -> None:
    """Best-effort deletion of objects from the R2/S3 bucket.

    Storage cleanup must NEVER block or roll back a DB delete, so all failures
    are logged and swallowed. No-ops when object storage is unconfigured / in
    mock mode (mirrors the ``configured`` gate used by the upload path), since
    in that case the files live on local disk, not the bucket.
    """
    keys = [k for k in keys if k]
    if not keys:
        return
    s = get_settings()
    configured = bool(s.S3_ACCESS_KEY and s.S3_SECRET_KEY and not s.USE_MOCK_INTEGRATIONS)
    if not configured:
        return
    try:
        client = _client()
        # delete_objects accepts up to 1000 keys per call.
        for i in range(0, len(keys), 1000):
            batch = keys[i:i + 1000]
            client.delete_objects(
                Bucket=s.S3_BUCKET,
                Delete={"Objects": [{"Key": k} for k in batch], "Quiet": True},
            )
    except Exception:  # noqa: BLE001 - storage cleanup is best-effort
        logger.exception("Failed to delete objects from storage: %s", keys)
