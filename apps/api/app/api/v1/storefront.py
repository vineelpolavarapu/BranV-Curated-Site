"""
Public storefront routes:
  GET /api/home
  GET /api/products
  GET /api/products/:slug
  GET /api/products/:slug/related
  GET /api/search/autocomplete

Mirrors apps/api/src/storefront/*.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db
from ...schemas.storefront import ProductListQuery
from ...services import storefront_service

home_router = APIRouter(prefix="/home", tags=["home"])
products_router = APIRouter(prefix="/products", tags=["products"])
search_router = APIRouter(prefix="/search", tags=["search"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


@home_router.get("")
async def home(db: DbDep) -> dict[str, Any]:
    return await storefront_service.home(db)


@products_router.get("")
async def list_products(
    db: DbDep,
    query_model: Annotated[ProductListQuery, Depends()],
) -> dict[str, Any]:
    return await storefront_service.list_products(db, query_model.model_dump(exclude_none=True))


@products_router.get("/{slug}")
async def product_detail(slug: str, db: DbDep) -> dict[str, Any]:
    p = await storefront_service.get_by_slug(db, slug)
    if p is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


@products_router.get("/{slug}/related")
async def product_related(slug: str, db: DbDep) -> list[dict[str, Any]]:
    return await storefront_service.related(db, slug)


@search_router.get("/autocomplete")
async def autocomplete(
    db: DbDep,
    q: Annotated[str, Query()] = "",
) -> dict[str, Any]:
    return await storefront_service.autocomplete(db, q)
