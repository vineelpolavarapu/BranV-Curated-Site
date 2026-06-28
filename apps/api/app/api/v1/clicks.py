"""
POST /api/clicks/track         — public, mint tracking id
POST /api/clicks/{id}/report   — public + optional-auth, record outcome
(GET /go/{tracking_id} lives in clicks_redirect.py — mounted OUTSIDE /api.)
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth_deps import current_user_optional
from ...db.session import get_db
from ...schemas.clicks import ReportClickRequest, TrackClickRequest
from ...services import clicks_service

router = APIRouter(prefix="/clicks", tags=["clicks"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.post("/track")
async def track(payload: TrackClickRequest, db: DbDep) -> dict[str, Any]:
    tracking_id = await clicks_service.mint_from_product(
        db,
        product_id=payload.productId,
        retailer=payload.retailer,
        source_page_url=payload.sourcePageUrl,
    )
    if tracking_id is None:
        return {"trackingId": None}
    return {"trackingId": tracking_id, "goUrl": f"/go/{tracking_id}"}


@router.post(
    "/{tracking_id}/report",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def report(
    tracking_id: str,
    payload: ReportClickRequest,
    request: Request,
    db: DbDep,
    user=Depends(current_user_optional),  # OPTIONAL auth — must not 401
) -> Response:
    await clicks_service.report_outcome(
        db,
        tracking_id=tracking_id,
        outcome=payload.outcome,
        user_id=user.id if user else None,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
