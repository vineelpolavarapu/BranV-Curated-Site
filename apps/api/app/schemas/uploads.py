"""Pydantic shapes for /api/uploads. Mirrors apps/api/src/uploads/dto/upload.dto.ts."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from ..core.pydantic_config import ApiModel

UploadKindLiteral = Literal[
    "brand-logo",
    "brand-hero",
    "product-image",
    "product-avatar",
    "avatar-reference",
    "article-hero",
    "lookbook-image",
    "banner",
]


class PresignUploadRequest(ApiModel):
    # Image MIME types only - same regex Nest enforces.
    contentType: str = Field(pattern=r"^image/(png|jpeg|jpg|webp|avif|gif)$")
    # Alphanumeric + dot, hyphen, underscore, space. Max 120 chars.
    filename: str = Field(max_length=120, pattern=r"^[\w.\- ]+$")
    kind: UploadKindLiteral
    ownerId: str | None = Field(default=None, max_length=80)


class PresignUploadResponse(ApiModel):
    uploadUrl: str
    publicUrl: str
    key: str
    expiresIn: int
