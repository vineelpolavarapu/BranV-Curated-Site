"""
Auto-generated from Prisma model `ClickEvent`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Enum as SAEnum, Index, TIMESTAMP, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import AffiliatePartner

from .base import Base


class ClickEvent(Base):
    __tablename__ = 'click_events'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    trackingId: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='trackingId')
    productId: Mapped[str] = mapped_column(Text, nullable=False, name='productId')
    retailer: Mapped[str] = mapped_column(Text, nullable=False, name='retailer')
    partner: Mapped[AffiliatePartner | None] = mapped_column(SAEnum(AffiliatePartner, name="AffiliatePartner", create_type=False, native_enum=True), nullable=True, name='partner')
    partnerUrl: Mapped[str] = mapped_column(Text, nullable=False, name='partnerUrl')
    sourcePageUrl: Mapped[str | None] = mapped_column(Text, nullable=True, name='sourcePageUrl')
    userId: Mapped[str | None] = mapped_column(Text, nullable=True, name='userId')
    sessionId: Mapped[str | None] = mapped_column(Text, nullable=True, name='sessionId')
    userAgent: Mapped[str | None] = mapped_column(Text, nullable=True, name='userAgent')
    ipCountry: Mapped[str | None] = mapped_column(Text, nullable=True, name='ipCountry')
    utm: Mapped[Any | None] = mapped_column(JSONB, nullable=True, name='utm')
    redirectedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='redirectedAt')

    __table_args__ = (
        Index('ix_click_events_productId', 'productId'),
        Index('ix_click_events_userId', 'userId'),
        Index('ix_click_events_redirectedAt', 'redirectedAt'),
    )
