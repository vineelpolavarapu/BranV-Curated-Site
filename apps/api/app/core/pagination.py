"""
Pagination DTO + page-result helper - port of `apps/api/src/common/dto/pagination.dto.ts`.

Query coercion parity:
  * `page` and `pageSize` arrive as strings on the wire; Pydantic coerces to int.
  * Defaults: page=1, pageSize=20.
  * Bounds: page>=1, 1<=pageSize<=100 (per-route overrides via copying the schema).
"""

from __future__ import annotations

import math
from typing import Annotated, Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field

from .pydantic_config import ApiModel

T = TypeVar("T")


PageParam = Annotated[int, Query(ge=1)]
PageSizeParam = Annotated[int, Query(ge=1, le=1000)]


def make_page(data: list[T], total: int, page: int, page_size: int) -> dict:
    """Returns the exact shape NestJS emits: {data, page, pageSize, total, totalPages}."""
    return {
        "data": data,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": max(1, math.ceil(total / page_size)) if page_size > 0 else 1,
    }


class PageResponse(ApiModel, Generic[T]):
    """Type-checked page envelope for use in router response_model annotations."""

    data: list[T]
    page: int
    pageSize: int
    total: int
    totalPages: int
