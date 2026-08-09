"""
Auto-generated from Prisma model `ClickIntent`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Enum as SAEnum, Index, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import AffiliatePartner

from .base import Base


class ClickIntent(Base):
    __tablename__ = 'click_intents'
    trackingId: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='trackingId')
    productId: Mapped[str] = mapped_column(Text, nullable=False, name='productId')
    retailer: Mapped[str] = mapped_column(Text, nullable=False, name='retailer')
    partner: Mapped[AffiliatePartner | None] = mapped_column(SAEnum(AffiliatePartner, name="AffiliatePartner", create_type=False, native_enum=True), nullable=True, name='partner')
    partnerUrl: Mapped[str] = mapped_column(Text, nullable=False, name='partnerUrl')
    sourcePageUrl: Mapped[str | None] = mapped_column(Text, nullable=True, name='sourcePageUrl')
    expiresAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, name='expiresAt')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')

    __table_args__ = (
        Index('ix_click_intents_expiresAt', 'expiresAt'),
    )
