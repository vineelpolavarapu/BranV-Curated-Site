"""Cuelinks affiliate URL conversion.

Mock + real-API skeleton. Real API call lives behind USE_MOCK_INTEGRATIONS=false.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from ..core.logging import get_logger
from ..core.settings import get_settings

log = get_logger("cuelinks")


@dataclass(slots=True)
class ConvertResult:
    convertedUrl: str
    partnerLinkId: str | None = None
    pending: bool = False
    error: str | None = None


async def convert_url(raw_url: str) -> ConvertResult:
    s = get_settings()
    if s.USE_MOCK_INTEGRATIONS or not s.CUELINKS_API_KEY:
        return ConvertResult(
            convertedUrl=f"https://linksredirect.com/?cid=mock&pubid=mock&source=branv&url={raw_url}",
            partnerLinkId="mock-cuelinks-id",
        )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(
                f"{s.CUELINKS_API_BASE}/links",
                headers={"X-Api-Key": s.CUELINKS_API_KEY},
                json={"url": raw_url},
            )
            r.raise_for_status()
            data = r.json()
            return ConvertResult(
                convertedUrl=data.get("converted_url", raw_url),
                partnerLinkId=data.get("id"),
            )
    except (httpx.TimeoutException, httpx.HTTPError) as e:
        # Pending — affiliate worker (Step 8 cron) will retry.
        log.warning("cuelinks_convert_failed", error=str(e))
        return ConvertResult(convertedUrl=raw_url, pending=True, error=str(e))
