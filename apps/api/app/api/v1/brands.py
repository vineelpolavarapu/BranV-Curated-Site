"""
/api/admin/brands  - admin CRUD
/api/brands        - public list + slug detail

Mirrors apps/api/src/brands/brands.controller.ts and
apps/api/src/storefront/brands-public.controller.ts.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth_deps import (
    AuthenticatedUser,
    current_user_required,
    enforce_two_factor,
    require_roles,
)
from ...db.session import get_db
from ...schemas.brands import CreateBrandRequest, UpdateBrandRequest
from ...services import brands_service

admin_router = APIRouter(prefix="/admin/brands", tags=["admin-brands"])
public_router = APIRouter(prefix="/brands", tags=["brands"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDeps = [
    Depends(current_user_required),
    Depends(require_roles("ADMIN")),
    Depends(enforce_two_factor),
]


# ───────────── admin ────────────────────────────────────────────────────────


@admin_router.get("", dependencies=AdminDeps)
async def admin_list(
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=1000)] = 20,
    search: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    return await brands_service.list_admin(db, page=page, page_size=pageSize, search=search)


@admin_router.get("/{brand_id}", dependencies=AdminDeps)
async def admin_get(brand_id: str, db: DbDep) -> dict[str, Any]:
    brand = await brands_service.get_by_id(db, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand


@admin_router.post("", status_code=status.HTTP_201_CREATED, dependencies=AdminDeps)
async def admin_create(
    payload: CreateBrandRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    return await brands_service.create(db, dto=payload.model_dump(), actor_id=user.id)


@admin_router.patch("/{brand_id}", dependencies=AdminDeps)
async def admin_update(
    brand_id: str,
    payload: UpdateBrandRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    updated = await brands_service.update_brand(
        db, brand_id=brand_id, dto=payload.model_dump(), actor_id=user.id
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return updated


@admin_router.delete(
    "/{brand_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,  # FastAPI: 204 must have no body
    dependencies=AdminDeps,
)
async def admin_delete(
    brand_id: str,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> Response:
    ok = await brands_service.delete_brand(db, brand_id=brand_id, actor_id=user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Brand not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ───────────── public ───────────────────────────────────────────────────────


@public_router.get("")
async def public_list(
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=1000)] = 200,
    search: Annotated[str | None, Query()] = None,
) -> Any:
    return await brands_service.list_public(db)


@public_router.get("/{slug}")
async def public_detail(slug: str, db: DbDep) -> dict[str, Any]:
    brand = await brands_service.get_public_by_slug(db, slug)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand
