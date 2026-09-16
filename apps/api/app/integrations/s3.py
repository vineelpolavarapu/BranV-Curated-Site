"""
S3 / MinIO presign - port of `apps/api/src/uploads/uploads.service.ts`.

The presign call is CPU-bound (HMAC + SHA256 over headers); use sync boto3 and
run it in a threadpool via FastAPI's default executor when called from async
routes. aioboto3 would work too but offers no real benefit for presign.

Folder layout, key format, and `expiresIn=600s` MUST match the Nest impl so
URLs already produced by Nest remain valid against the FastAPI service.
"""

from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import logging
import secrets
import socket
import string
from dataclasses import dataclass
from typing import Literal
from urllib.parse import urlparse

import boto3
import httpx
from botocore.client import Config

from ..core.settings import get_settings

logger = logging.getLogger(__name__)

# Image ingestion tuning. Reject non-image / oversized / trivially-tiny payloads
# (error pages, 1x1 tracking pixels) so we never mirror garbage to R2.
_INGEST_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
_INGEST_MIN_BYTES = 1024  # 1 KB - below this it's almost certainly a pixel/placeholder
_INGEST_TIMEOUT = 20.0

# Map a fetched Content-Type to a file extension for the R2 object key.
_CONTENT_TYPE_EXT = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
}

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


def _ingest_key(kind: UploadKind, ownerId: str | None, digest: str, ext: str) -> str:
    """Content-addressed object key so identical bytes dedup and re-ingestion is
    idempotent (same URL scraped twice → same key → single object)."""
    folder = _FOLDER_MAP[kind]
    owner_segment = f"{ownerId}/" if ownerId else ""
    return f"{folder}/{owner_segment}{digest[:32]}.{ext}"


async def is_safe_public_url(url: str) -> bool:
    """SSRF guard: True only for an http(s) URL whose host resolves entirely to
    public IPs. Rejects loopback/private/link-local/reserved targets so a
    user-supplied URL (e.g. the image-preview proxy) can't be pointed at internal
    services or cloud metadata (169.254.169.254)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    try:
        infos = await asyncio.to_thread(socket.getaddrinfo, parsed.hostname, None)
    except Exception:
        return False
    for info in infos:
        try:
            addr = ipaddress.ip_address(info[4][0])
        except ValueError:
            return False
        if (
            addr.is_private or addr.is_loopback or addr.is_link_local
            or addr.is_reserved or addr.is_multicast or addr.is_unspecified
        ):
            return False
    return True


async def fetch_remote_image_bytes(
    url: str, *, referer: str | None = None, min_bytes: int = _INGEST_MIN_BYTES,
) -> tuple[bytes, str] | None:
    """Fetch a remote image with browser-like headers and return ``(bytes, content_type)``.

    Referer defaults to the image's own origin — most retailer-CDN hotlink checks
    allow same-origin requests, so this defeats them even without the product page.
    Returns ``None`` when the fetch fails or the response isn't a valid image within
    size bounds. Shared by :func:`ingest_remote_image` (re-host to R2) and the admin
    image-preview proxy (stream back for the browser). Does NOT do SSRF filtering —
    callers that accept user-supplied URLs must gate with :func:`is_safe_public_url`.
    """
    s = get_settings()
    if not referer:
        parsed = urlparse(url)
        if parsed.scheme and parsed.netloc:
            referer = f"{parsed.scheme}://{parsed.netloc}/"

    ua = s.SCRAPER_USER_AGENT
    if not ua or "bot" in ua.lower():
        ua = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        )
    headers = {
        "User-Agent": ua,
        "Accept": "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
    }
    if referer:
        headers["Referer"] = referer

    try:
        async with httpx.AsyncClient(
            timeout=_INGEST_TIMEOUT, follow_redirects=True, headers=headers
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            content = resp.content
    except Exception as exc:
        logger.warning("fetch_remote_image_bytes failed url=%s err=%s", url, exc)
        return None

    content_type = (resp.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if not content_type.startswith("image/"):
        logger.warning("fetch_remote_image_bytes non-image content-type=%s url=%s", content_type, url)
        return None
    if not (min_bytes <= len(content) <= _INGEST_MAX_BYTES):
        logger.warning("fetch_remote_image_bytes size out of bounds bytes=%d url=%s", len(content), url)
        return None
    return content, content_type


async def ingest_remote_image(
    url: str,
    *,
    kind: UploadKind = "product-image",
    ownerId: str | None = None,
    referer: str | None = None,
) -> str | None:
    """Download a remote image and mirror it into our own R2/S3 bucket, returning
    the public URL to store in ``ProductImage.url``.

    This is the core of "never hotlink a retailer URL": scraped images live on
    retailer CDNs that enforce hotlink/referer protection, region-lock, or expire,
    so the storefront can't load them. We fetch the bytes once (via
    :func:`fetch_remote_image_bytes`), validate they're a real image, and re-host on
    R2 under a content-addressed key.

    Returns the R2 public URL on success, or ``None`` when the fetch/validate/upload
    fails (caller decides whether to skip the image or keep the original URL). No-ops
    to ``None`` when object storage isn't configured (mock/dev) so callers fall back
    to the original behavior instead of storing an unreachable key.
    """
    s = get_settings()
    configured = bool(s.S3_ACCESS_KEY and s.S3_SECRET_KEY and not s.USE_MOCK_INTEGRATIONS)
    if not configured:
        return None

    fetched = await fetch_remote_image_bytes(url, referer=referer)
    if not fetched:
        return None
    content, content_type = fetched

    digest = hashlib.sha256(content).hexdigest()
    ext = _CONTENT_TYPE_EXT.get(content_type, "jpg")
    key = _ingest_key(kind, ownerId, digest, ext)

    def _put() -> None:
        client = _client()
        client.put_object(
            Bucket=s.S3_BUCKET,
            Key=key,
            Body=content,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )

    try:
        await asyncio.to_thread(_put)
    except Exception as exc:
        logger.warning("ingest_remote_image put_object failed key=%s err=%s", key, exc)
        return None

    return f"{public_base(s)}/{key}"


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
    except Exception:
        logger.exception("Failed to delete objects from storage: %s", keys)
