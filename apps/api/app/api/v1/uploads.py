import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from starlette.concurrency import run_in_threadpool

from ...core.auth_deps import current_user_required, require_roles
from ...core.settings import get_settings
from ...integrations.s3 import presign_upload, public_base
from ...schemas.uploads import PresignUploadRequest, PresignUploadResponse

router = APIRouter(prefix="/uploads", tags=["uploads"])

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads_storage"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

WEB_PUBLIC_DIR = Path(__file__).resolve().parents[4] / "web" / "public" / "uploads"
try:
    WEB_PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass


@router.post(
    "/presign",
    response_model=PresignUploadResponse,
    dependencies=[
        Depends(current_user_required),
        Depends(require_roles("ADMIN")),
    ],
)
async def presign(payload: PresignUploadRequest) -> PresignUploadResponse:
    s = get_settings()
    # boto3's presign is sync + CPU-bound - push it to the threadpool
    result = await run_in_threadpool(
        presign_upload,
        contentType=payload.contentType,
        filename=payload.filename,
        kind=payload.kind,
        ownerId=payload.ownerId,
    )

    # If S3 endpoint is on localhost or mock mode, proxy storage through local uploads route
    if s.USE_MOCK_INTEGRATIONS or "localhost" in (s.S3_ENDPOINT or ""):
        upload_url = f"http://localhost:{s.API_INTERNAL_PORT}/api/uploads/storage/{result.key}"
        public_url = f"/uploads/{result.key.replace('/', '_')}"
        return PresignUploadResponse(
            uploadUrl=upload_url,
            publicUrl=public_url,
            key=result.key,
            expiresIn=result.expiresIn,
        )

    return PresignUploadResponse(
        uploadUrl=result.uploadUrl,
        publicUrl=result.publicUrl,
        key=result.key,
        expiresIn=result.expiresIn,
    )


@router.post(
    "/file",
    dependencies=[
        Depends(current_user_required),
        Depends(require_roles("ADMIN")),
    ],
)
async def upload_direct_file(
    file: UploadFile = File(...),
    kind: str = Form(default="product-avatar"),
) -> dict[str, str]:
    """Direct file upload via multipart/form-data. Uploads to R2/S3 server-side
    (bypassing browser CORS) when configured, or falls back to local storage in
    dev (MinIO off / mock mode).

    Important: when object storage IS configured we must NOT silently fall back to
    a local ``/uploads/`` URL on a put_object failure - that URL is unreachable from
    the deployed web (Vercel) and would silently produce a permanently-broken image.
    Surface the error instead so the admin retry, and we never store a URL the
    browser can't load.
    """
    from ...integrations.s3 import _build_key, _client
    s = get_settings()
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png"
    filename = f"{uuid.uuid4().hex}.{ext}"
    content = await file.read()
    key = _build_key(kind, file.filename or filename, None)

    configured = bool(s.S3_ACCESS_KEY and s.S3_SECRET_KEY and not s.USE_MOCK_INTEGRATIONS)

    # Server-side upload to R2/S3 bucket (no browser CORS restriction!)
    if configured:
        try:
            client = await run_in_threadpool(_client)
            await run_in_threadpool(
                client.put_object,
                Bucket=s.S3_BUCKET,
                Key=key,
                Body=content,
                ContentType=file.content_type or f"image/{ext}",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Object storage upload failed: {exc}",
            ) from exc
        public_url = f"{public_base(s)}/{key}"
        return {
            "uploadUrl": public_url,
            "publicUrl": public_url,
            "key": key,
        }

    # Dev / unconfigured fallback: save to local disk so the same machine can serve
    # it (apps/web/public/uploads). Acceptable locally; never used in production.
    # S3_PUBLIC_URL does NOT apply here - the file was never written to object
    # storage, only to local disk, so the URL must be the local /uploads path.
    target_path = UPLOAD_DIR / filename
    with open(target_path, "wb") as f:
        f.write(content)

    if WEB_PUBLIC_DIR.exists():
        try:
            with open(WEB_PUBLIC_DIR / filename, "wb") as f:
                f.write(content)
        except Exception:
            pass

    public_url = f"/uploads/{filename}"
    return {
        "uploadUrl": public_url,
        "publicUrl": public_url,
        "key": key,
    }


@router.options("/storage/{key:path}")
async def preflight_storage_upload(key: str) -> Response:
    """Handle CORS preflight for storage uploads."""
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "PUT, POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        },
    )


@router.put("/storage/{key:path}")
@router.post("/storage/{key:path}")
async def handle_storage_upload(key: str, request: Request) -> Response:
    """Fallback handler for storage uploads. Stores raw bytes and returns 200 OK with CORS."""
    body = await request.body()
    safe_key = key.replace("/", "_")
    target_path = UPLOAD_DIR / safe_key
    with open(target_path, "wb") as f:
        f.write(body)

    if WEB_PUBLIC_DIR.exists():
        try:
            with open(WEB_PUBLIC_DIR / safe_key, "wb") as f:
                f.write(body)
        except Exception:
            pass

    public_url = f"/uploads/{safe_key}"
    return Response(
        content=f'{{"publicUrl": "{public_url}"}}',
        media_type="application/json",
        status_code=200,
        headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
    )


@router.get("/storage/{key:path}")
async def serve_storage_file(key: str) -> Response:
    """Serve uploaded local storage files."""
    safe_key = key.replace("/", "_")
    target_path = UPLOAD_DIR / safe_key
    if not target_path.exists():
        # Fallback check original key
        target_path = UPLOAD_DIR / key
        if not target_path.exists():
            raise HTTPException(404, "File not found")

    content = target_path.read_bytes()
    ext = key.rsplit(".", 1)[-1].lower()
    media_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "gif": "image/gif",
        "avif": "image/avif",
    }
    return Response(
        content=content,
        media_type=media_types.get(ext, "image/png"),
        headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=31536000"},
    )
