"""
Resend email provider - real implementation behind USE_MOCK_INTEGRATIONS=false.

When the mock toggle is on (default in dev), this module is never reached;
`app.integrations.mail.MailService` short-circuits to stdout logging instead.
"""

from __future__ import annotations

import httpx

from ..core.logging import get_logger
from ..core.settings import get_settings

log = get_logger("resend")


async def send(*, to: str, subject: str, text: str, html: str | None = None) -> None:
    s = get_settings()
    if not s.MAIL_API_KEY:
        raise RuntimeError("MAIL_API_KEY not configured")
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {s.MAIL_API_KEY}"},
            json={"from": s.MAIL_FROM, "to": [to], "subject": subject, "text": text, "html": html},
        )
        r.raise_for_status()
        log.info("mail_sent", extra={"to": to, "subject": subject, "id": r.json().get("id")})
