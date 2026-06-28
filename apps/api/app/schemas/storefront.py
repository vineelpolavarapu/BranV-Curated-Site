"""Public storefront request shapes. Mirrors apps/api/src/storefront/dto/storefront.dto.ts."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import Query
from pydantic import Field, field_validator

from ..core.pydantic_config import ApiModel, csv_or_array_str, loose_bool

ProductSortLiteral = Literal[
    "relevance", "newest", "price_asc", "price_desc", "best_rated", "popular",
]


class ProductListQuery(ApiModel):
    page: int = Field(default=1, ge=1)
    pageSize: int = Field(default=24, ge=1, le=60)
    search: str | None = None
    category: str | None = None
    brand: list[str] | None = None
    color: list[str] | None = None
    size: list[str] | None = None
    retailer: list[str] | None = None
    material: str | None = None
    minPrice: float | None = Field(default=None, ge=0)
    maxPrice: float | None = Field(default=None, ge=0)
    inStock: bool | None = None
    onSale: bool | None = None
    isNew: bool | None = None
    discount: float | None = Field(default=None, ge=0, le=100)
    sort: ProductSortLiteral | None = None

    @field_validator("brand", "color", "size", "retailer", mode="before")
    @classmethod
    def _multi(cls, v):
        return csv_or_array_str(v) if v is not None else None

    @field_validator("inStock", "onSale", "isNew", mode="before")
    @classmethod
    def _b(cls, v):
        if v is None:
            return None
        try:
            return loose_bool(v)
        except ValueError:
            return None
