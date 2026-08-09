"""
Auto-generated from Prisma model `AffiliatePayoutItem`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Enum as SAEnum, Index, Numeric, TIMESTAMP, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import AffiliatePayoutItemStatus

from .base import Base


class AffiliatePayoutItem(Base):
    __tablename__ = 'affiliate_payout_items'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    payoutId: Mapped[str] = mapped_column(Text, nullable=False, name='payoutId')
    matchedClickEventId: Mapped[str | None] = mapped_column(Text, nullable=True, name='matchedClickEventId')
    retailerOrderId: Mapped[str | None] = mapped_column(Text, nullable=True, name='retailerOrderId')
    amountInr: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True, name='amountInr')
    commissionInr: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True, name='commissionInr')
    occurredAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='occurredAt')
    status: Mapped[AffiliatePayoutItemStatus] = mapped_column(SAEnum(AffiliatePayoutItemStatus, name="AffiliatePayoutItemStatus", create_type=False, native_enum=True), nullable=False, server_default=text('UNMATCHED'), name='status')
    rowHash: Mapped[str] = mapped_column(Text, nullable=False, name='rowHash')
    rawRow: Mapped[Any | None] = mapped_column(JSONB, nullable=True, name='rawRow')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')

    __table_args__ = (
        Index('ix_affiliate_payout_items_matchedClickEventId', 'matchedClickEventId'),
        Index('ix_affiliate_payout_items_status', 'status'),
        UniqueConstraint('payoutId', 'rowHash', name='uq_affiliate_payout_items_payoutId_rowHash'),
    )
