"""
Auto-generated from Prisma model `AffiliatePayout`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Enum as SAEnum, Index, Integer, Numeric, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import AffiliatePartner

from .base import Base


class AffiliatePayout(Base):
    __tablename__ = 'affiliate_payouts'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    partner: Mapped[AffiliatePartner] = mapped_column(SAEnum(AffiliatePartner, name="AffiliatePartner", create_type=False, native_enum=True), nullable=False, name='partner')
    reportedPeriodStart: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='reportedPeriodStart')
    reportedPeriodEnd: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='reportedPeriodEnd')
    reportedClicks: Mapped[int | None] = mapped_column(Integer, nullable=True, name='reportedClicks')
    reportedOrders: Mapped[int | None] = mapped_column(Integer, nullable=True, name='reportedOrders')
    reportedCommissionInr: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True, name='reportedCommissionInr')
    csvHash: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='csvHash')
    csvFilename: Mapped[str | None] = mapped_column(Text, nullable=True, name='csvFilename')
    rowCount: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='rowCount')
    matchedCount: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='matchedCount')
    unmatchedCount: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='unmatchedCount')
    ambiguousCount: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='ambiguousCount')
    uploadedById: Mapped[str | None] = mapped_column(Text, nullable=True, name='uploadedById')
    notes: Mapped[str | None] = mapped_column(Text, nullable=True, name='notes')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')

    __table_args__ = (
        Index('ix_affiliate_payouts_partner_createdAt', 'partner', 'createdAt'),
    )
