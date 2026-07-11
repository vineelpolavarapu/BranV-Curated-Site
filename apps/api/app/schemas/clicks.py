"""Click-tracking request schemas. Mirrors apps/api/src/clicks/dto/clicks.dto.ts."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from ..core.pydantic_config import ApiModel


class TrackClickRequest(ApiModel):
    productId: str = Field(min_length=1, max_length=64)
    retailer: str = Field(min_length=1, max_length=64)
    sourcePageUrl: str | None = Field(default=None, min_length=1, max_length=1024)


class ReportClickRequest(ApiModel):
    outcome: Literal["PURCHASED", "BROWSING", "NEEDS_HELP"]
