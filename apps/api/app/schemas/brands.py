"""Pydantic shapes for /api/admin/brands and /api/brands. Mirrors apps/api/src/brands/dto/brand.dto.ts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator

from ..core.pydantic_config import ApiModel

BrandStatusLiteral = Literal["ACTIVE", "HIDDEN", "ARCHIVED"]


def _url_or_none(v: str | None) -> str | None:
    """Same lenient URL check Nest's @IsUrl({require_tld:false}) accepts."""
    if v is None:
        return None
    if v == "":
        return None
    if not (v.startswith("http://") or v.startswith("https://")):
        raise ValueError("must be an http(s) URL")
    return v


class CreateBrandRequest(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=120)
    logoUrl: str | None = None
    heroUrl: str | None = None
    description: str | None = Field(default=None, max_length=2000)
    isFeatured: bool | None = None
    status: BrandStatusLiteral | None = None

    @field_validator("logoUrl", "heroUrl", mode="before")
    @classmethod
    def _v(cls, v):
        return _url_or_none(v)


class UpdateBrandRequest(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=120)
    logoUrl: str | None = None
    heroUrl: str | None = None
    description: str | None = Field(default=None, max_length=2000)
    isFeatured: bool | None = None
    status: BrandStatusLiteral | None = None

    @field_validator("logoUrl", "heroUrl", mode="before")
    @classmethod
    def _v(cls, v):
        return _url_or_none(v)


class BrandResponse(ApiModel):
    id: str
    slug: str
    name: str
    logoUrl: str | None = None
    heroUrl: str | None = None
    description: str | None = None
    isFeatured: bool
    status: BrandStatusLiteral
    createdAt: datetime
    updatedAt: datetime
