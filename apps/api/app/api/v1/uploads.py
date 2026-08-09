import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile, Response
from starlette.concurrency import run_in_threadpool

from ...core.auth_deps import current_user_required, require_roles
from ...core.settings import get_settings
from ...integrations.s3 import presign_upload
from ...schemas.uploads import PresignUploadRequest, PresignUploadResponse

router = APIRouter(prefix="/uploads", tags=["uploads"])

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads_storage"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


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
        public_url = f"http://localhost:{s.API_INTERNAL_PORT}/api/uploads/storage/{result.key}"
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
async def upload_direct_file(file: UploadFile = File(...)) -> dict[str, str]:
    """Direct file upload via multipart/form-data. Stores file locally or in S3."""
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png"
    filename = f"{uuid.uuid4().hex}.{ext}"
    target_path = UPLOAD_DIR / filename
    content = await file.read()
    with open(target_path, "wb") as f:
        f.write(content)

    s = get_settings()
    public_url = f"http://localhost:{s.API_INTERNAL_PORT}/api/uploads/storage/{filename}"
    return {
        "uploadUrl": public_url,
        "publicUrl": public_url,
        "key": filename,
    }


@router.put("/storage/{key:path}")
@router.post("/storage/{key:path}")
async def handle_storage_upload(key: str, body: bytes = Body(default=b"")) -> Response:
    """Fallback handler for storage uploads. Stores raw bytes and returns 200 OK with CORS."""
    safe_key = key.replace("/", "_")
    target_path = UPLOAD_DIR / safe_key
    with open(target_path, "wb") as f:
        f.write(body)

    s = get_settings()
    public_url = f"http://localhost:{s.API_INTERNAL_PORT}/api/uploads/storage/{safe_key}"
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
