"""
Auto-generated from Prisma model `AffiliateLink`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Enum as SAEnum, Index, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import AffiliatePartner

from .base import Base


class AffiliateLink(Base):
    __tablename__ = 'affiliate_links'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    productRetailerListingId: Mapped[str] = mapped_column(Text, nullable=False, name='productRetailerListingId')
    partner: Mapped[AffiliatePartner] = mapped_column(SAEnum(AffiliatePartner, name="AffiliatePartner", create_type=False, native_enum=True), nullable=False, name='partner')
    rawUrl: Mapped[str] = mapped_column(Text, nullable=False, name='rawUrl')
    convertedUrl: Mapped[str] = mapped_column(Text, nullable=False, name='convertedUrl')
    partnerLinkId: Mapped[str | None] = mapped_column(Text, nullable=True, name='partnerLinkId')
    pendingConversion: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('false'), name='pendingConversion')
    lastValidatedAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='lastValidatedAt')
    lastError: Mapped[str | None] = mapped_column(Text, nullable=True, name='lastError')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_affiliate_links_productRetailerListingId', 'productRetailerListingId'),
        Index('ix_affiliate_links_pendingConversion', 'pendingConversion'),
    )
