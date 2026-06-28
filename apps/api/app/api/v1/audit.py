"""
GET /api/admin/audit — admin-only paginated audit-log listing with filters.

Mirrors apps/api/src/audit/audit.controller.ts.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth_deps import current_user_required, enforce_two_factor, require_roles
from ...db.session import get_db
from ...services import audit_service
from ...services.audit_service import AuditListQuery

router = APIRouter(prefix="/admin/audit", tags=["admin-audit"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


def _parse_iso(value: str | None, *, field: str) -> datetime | None:
    if value is None:
        return None
    try:
        # Accept the ISO 8601 forms class-validator's @IsDateString allows.
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail=[f"{field}: must be ISO 8601 date string"]) from None


@router.get(
    "",
    dependencies=[
        Depends(current_user_required),
        Depends(require_roles("ADMIN")),
        Depends(enforce_two_factor),
    ],
)
async def list_audit(
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=200)] = 50,
    actorId: Annotated[str | None, Query()] = None,
    action: Annotated[str | None, Query()] = None,
    targetType: Annotated[str | None, Query()] = None,
    from_: Annotated[str | None, Query(alias="from")] = None,
    to: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    return await audit_service.list_audit_logs(
        db,
        AuditListQuery(
            page=page,
            pageSize=pageSize,
            actorId=actorId,
            action=action,
            targetType=targetType,
            from_=_parse_iso(from_, field="from"),
            to=_parse_iso(to, field="to"),
        ),
    )
