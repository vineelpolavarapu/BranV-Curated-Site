"""Public /api/categories + admin /api/admin/categories attribute-schema endpoints."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth_deps import (
    AuthenticatedUser,
    current_user_required,
    enforce_two_factor,
    require_roles,
)
from ...db.session import get_db
from ...schemas.categories import BulkUpsertAttributeSchemaRequest, UpsertAttributeSchemaRequest
from ...services import categories_service

public_router = APIRouter(prefix="/categories", tags=["categories"])
admin_router = APIRouter(prefix="/admin/categories", tags=["admin-categories"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDeps = [
    Depends(current_user_required),
    Depends(require_roles("ADMIN")),
    Depends(enforce_two_factor),
]


@public_router.get("")
async def public_list(db: DbDep) -> list[dict[str, Any]]:
    return await categories_service.list_all(db)


@public_router.get("/{slug}")
async def public_detail(slug: str, db: DbDep) -> dict[str, Any]:
    cat = await categories_service.get_by_slug(db, slug)
    if cat is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return cat


@public_router.get("/{slug}/filters")
async def public_filters(slug: str, db: DbDep) -> dict[str, Any]:
    cat = await categories_service.get_by_slug(db, slug)
    if cat is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"categorySlug": slug, "filters": cat["attributeSchemas"]}


@admin_router.get("", dependencies=AdminDeps)
async def admin_list(db: DbDep) -> list[dict[str, Any]]:
    return await categories_service.list_all(db)


@admin_router.get("/{category_id}/attribute-schemas", dependencies=AdminDeps)
async def admin_list_schemas(category_id: str, db: DbDep) -> list[dict[str, Any]]:
    rows = await categories_service.list_schemas(db, category_id)
    if rows is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return rows


@admin_router.post("/{category_id}/attribute-schemas", status_code=201, dependencies=AdminDeps)
async def admin_upsert_schema(
    category_id: str,
    payload: UpsertAttributeSchemaRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    result = await categories_service.upsert_schema(
        db, category_id=category_id, dto=payload.model_dump(), actor_id=user.id
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return result


@admin_router.put("/{category_id}/attribute-schemas", dependencies=AdminDeps)
async def admin_bulk_upsert(
    category_id: str,
    payload: BulkUpsertAttributeSchemaRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> list[dict[str, Any]]:
    result = await categories_service.bulk_upsert(
        db,
        category_id=category_id,
        items=[s.model_dump() for s in payload.schemas],
        actor_id=user.id,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return result


@admin_router.delete(
    "/{category_id}/attribute-schemas/{attribute_key}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=AdminDeps,
)
async def admin_delete_schema(
    category_id: str,
    attribute_key: str,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> Response:
    ok = await categories_service.delete_schema(
        db, category_id=category_id, attribute_key=attribute_key, actor_id=user.id
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Category not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
