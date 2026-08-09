"""
Mail adapter - mirrors `apps/api/src/mail/mail.service.ts`.

USE_MOCK_INTEGRATIONS=true (default in dev): writes the message body to stdout
exactly like Nest does, so the verification / reset links can be grabbed from
the API logs without a real provider.

USE_MOCK_INTEGRATIONS=false (production): sends via the configured provider
(Resend). If no MAIL_API_KEY is set yet, the message is logged and the call
returns WITHOUT raising - email must never be a hard dependency of the flows
that call it (registration, password reset). Callers that need delivery
guarantees should treat sends as best-effort and surface/retry accordingly.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from ..core.logging import get_logger
from ..core.settings import get_settings

log = get_logger("mail")


@dataclass(slots=True)
class MailMessage:
    to: str
    subject: str
    text: str
    html: str | None = None


class MailService:
    def __init__(self) -> None:
        s = get_settings()
        self.mock = s.USE_MOCK_INTEGRATIONS
        self.from_addr = s.MAIL_FROM

    async def send(self, message: MailMessage) -> None:
        if self.mock:
            # Match the Nest log shape so dev tooling that greps for these works
            # against either backend.
            log.info(
                "mock_mail",
                extra={
                    "from": self.from_addr,
                    "to": message.to,
                    "subject": message.subject,
                    "text": message.text,
                },
            )
            return

        s = get_settings()
        if not s.MAIL_API_KEY:
            # Real integrations are on, but no provider key is configured yet.
            # Log the message (so verification / reset links remain recoverable
            # from the API logs) and return WITHOUT raising - a missing key must
            # not break registration or password-reset.
            log.warning(
                "mail_no_api_key",
                extra={
                    "to": message.to,
                    "subject": message.subject,
                    "text": message.text,
                },
            )
            return

        provider = (s.MAIL_PROVIDER or "").lower()
        if provider == "resend":
            await self._send_via_resend(s.MAIL_API_KEY, message)
        else:
            log.warning(
                "mail_provider_unsupported",
                extra={
                    "provider": s.MAIL_PROVIDER,
                    "to": message.to,
                },
            )

    async def _send_via_resend(self, api_key: str, message: MailMessage) -> None:
        body: dict[str, object] = {
            "from": self.from_addr,
            "to": [message.to],
            "subject": message.subject,
            "text": message.text,
        }
        if message.html:
            body["html"] = message.html
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}"},
                json=body,
            )
            r.raise_for_status()
        log.info("mail_sent", extra={"provider": "resend", "to": message.to, "subject": message.subject})

    async def send_email_verification(self, to: str, link: str) -> None:
        await self.send(
            MailMessage(
                to=to,
                subject="Verify your BranV email",
                text=(
                    "Welcome to BranV.\n\n"
                    f"Verify your email by visiting:\n{link}\n\n"
                    "This link expires in 24 hours."
                ),
            )
        )

    async def send_password_reset(self, to: str, link: str, *, totp_will_reset: bool = False) -> None:
        totp_note = (
            "\n\nCompleting this reset will also turn off two-factor authentication "
            "on your account - you'll need to re-enroll a new authenticator app afterward."
            if totp_will_reset
            else ""
        )
        await self.send(
            MailMessage(
                to=to,
                subject="Reset your BranV password",
                text=(
                    f"Reset your BranV password by visiting:\n{link}\n\n"
                    "This link expires in 1 hour. If you didn't request this, "
                    f"ignore this message.{totp_note}"
                ),
            )
        )


_singleton: MailService | None = None


def get_mail_service() -> MailService:
    global _singleton
    if _singleton is None:
        _singleton = MailService()
    return _singleton
