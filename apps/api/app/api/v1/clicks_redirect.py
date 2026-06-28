"""
Root-mounted route: GET /go/{tracking_id} → 302 redirect to the affiliate URL.

Lives OUTSIDE the /api global prefix to match NestJS's `setGlobalPrefix('api', {
  exclude: [{ path: 'go/:trackingId', method: RequestMethod.GET }]
})`. Reads `utm_*` query params, `sid` cookie, and `cf-ipcountry` header.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth_deps import current_user_optional
from ...db.session import get_db
from ...services import clicks_service
from ...services.clicks_service import TrackingGone

router = APIRouter()


@router.get("/go/{tracking_id}")
async def go_redirect(
    tracking_id: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user=Depends(current_user_optional),
) -> RedirectResponse:
    utm = {
        k: (v if isinstance(v, str) else (v[0] if v else ""))
        for k, v in request.query_params.multi_items()
        if k.lower().startswith("utm_")
    }
    try:
        target = await clicks_service.consume_redirect(
            db,
            tracking_id=tracking_id,
            user_id=user.id if user else None,
            session_id=request.cookies.get("sid"),
            user_agent=request.headers.get("user-agent"),
            ip_country=request.headers.get("cf-ipcountry"),
            utm=utm or None,
        )
    except TrackingGone as e:
        raise HTTPException(status_code=410, detail=str(e)) from None
    return RedirectResponse(url=target, status_code=302)
