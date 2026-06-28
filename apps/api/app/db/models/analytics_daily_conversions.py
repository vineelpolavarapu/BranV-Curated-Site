"""
Auto-generated from Prisma model `AnalyticsDailyConversions`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, Index, Integer, Numeric, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class AnalyticsDailyConversions(Base):
    __tablename__ = 'analytics_daily_conversions'
    day: Mapped[date] = mapped_column(Date, primary_key=True, nullable=False, name='day')
    productId: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='productId')
    selfReportedPurchases: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='selfReportedPurchases')
    selfReportedBrowsing: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='selfReportedBrowsing')
    selfReportedNeedsHelp: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='selfReportedNeedsHelp')
    estimatedCommissionInr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default=text('0'), name='estimatedCommissionInr')
    reconciledCommissionInr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default=text('0'), name='reconciledCommissionInr')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_analytics_daily_conversions_day', 'day'),
    )
