"""Pydantic shapes for /api/uploads. Mirrors apps/api/src/uploads/dto/upload.dto.ts."""

from __future__ import annotations

from typing import Literal

from pydantic import Field, field_validator

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
    contentType: str = Field(default="image/png")
    filename: str = Field(default="image.png")
    kind: UploadKindLiteral
    ownerId: str | None = Field(default=None, max_length=80)

    @field_validator("contentType", mode="before")
    @classmethod
    def clean_content_type(cls, v: str) -> str:
        if not v or not isinstance(v, str):
            return "image/png"
        v_clean = v.split(";")[0].strip().lower()
        if not v_clean.startswith("image/"):
            return "image/png"
        return v_clean

    @field_validator("filename", mode="before")
    @classmethod
    def clean_filename(cls, v: str) -> str:
        if not v or not isinstance(v, str):
            return "upload.png"
        import re
        sanitized = re.sub(r"[^\w.\- ]", "_", v).strip()
        return sanitized[:120] if sanitized else "upload.png"


class PresignUploadResponse(ApiModel):
    uploadUrl: str
    publicUrl: str
    key: str
    expiresIn: int
