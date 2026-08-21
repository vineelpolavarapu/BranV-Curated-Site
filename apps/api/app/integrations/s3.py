"""
S3 / MinIO presign - port of `apps/api/src/uploads/uploads.service.ts`.

The presign call is CPU-bound (HMAC + SHA256 over headers); use sync boto3 and
run it in a threadpool via FastAPI's default executor when called from async
routes. aioboto3 would work too but offers no real benefit for presign.

Folder layout, key format, and `expiresIn=600s` MUST match the Nest impl so
URLs already produced by Nest remain valid against the FastAPI service.
"""

from __future__ import annotations

import secrets
import string
from dataclasses import dataclass
from typing import Literal

import boto3
from botocore.client import Config

from ..core.settings import get_settings

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
