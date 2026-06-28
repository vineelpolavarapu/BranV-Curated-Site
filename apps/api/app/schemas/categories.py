"""Mirrors apps/api/src/categories/dto/category.dto.ts."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from ..core.pydantic_config import ApiModel

FilterTypeLiteral = Literal["SELECT", "MULTI_SELECT", "RANGE", "TOGGLE"]


class UpsertAttributeSchemaRequest(ApiModel):
    attributeKey: str = Field(min_length=1, max_length=60)
    displayName: str = Field(min_length=1, max_length=80)
    filterType: FilterTypeLiteral
    optionsJson: dict[str, Any] | list[str] | None = None
    displayOrder: int | None = Field(default=None, ge=0)


class BulkUpsertAttributeSchemaRequest(ApiModel):
    schemas: list[UpsertAttributeSchemaRequest] = Field(max_length=30)
