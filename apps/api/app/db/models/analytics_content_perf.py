"""
Auto-generated from Prisma model `AnalyticsContentPerf`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, Index, Integer, Numeric, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class AnalyticsContentPerf(Base):
    __tablename__ = 'analytics_content_perf'
    day: Mapped[date] = mapped_column(Date, primary_key=True, nullable=False, name='day')
    surfaceType: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='surfaceType')
    surfaceSlug: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='surfaceSlug')
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='clicks')
    selfReportedConversions: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='selfReportedConversions')
    reconciledCommissionInr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default=text('0'), name='reconciledCommissionInr')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_analytics_content_perf_day', 'day'),
        Index('ix_analytics_content_perf_surfaceType_day', 'surfaceType', 'day'),
    )
