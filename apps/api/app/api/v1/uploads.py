"""
POST /api/uploads/presign - admin-only S3 presigned-URL generator.

Mirrors apps/api/src/uploads/uploads.controller.ts.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from starlette.concurrency import run_in_threadpool

from ...core.auth_deps import current_user_required, enforce_two_factor, require_roles
from ...integrations.s3 import presign_upload
from ...schemas.uploads import PresignUploadRequest, PresignUploadResponse

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post(
    "/presign",
    response_model=PresignUploadResponse,
    dependencies=[
        Depends(current_user_required),
        Depends(require_roles("ADMIN")),
        Depends(enforce_two_factor),
    ],
)
async def presign(payload: PresignUploadRequest) -> PresignUploadResponse:
    # boto3's presign is sync + CPU-bound - push it to the threadpool so the
    # event loop stays responsive under load.
    result = await run_in_threadpool(
        presign_upload,
        contentType=payload.contentType,
        filename=payload.filename,
        kind=payload.kind,
        ownerId=payload.ownerId,
    )
    return PresignUploadResponse(
        uploadUrl=result.uploadUrl,
        publicUrl=result.publicUrl,
        key=result.key,
        expiresIn=result.expiresIn,
    )
