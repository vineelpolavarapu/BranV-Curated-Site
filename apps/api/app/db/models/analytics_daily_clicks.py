"""
Auto-generated from Prisma model `AnalyticsDailyClicks`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, Index, Integer, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class AnalyticsDailyClicks(Base):
    __tablename__ = 'analytics_daily_clicks'
    day: Mapped[date] = mapped_column(Date, primary_key=True, nullable=False, name='day')
    productId: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='productId')
    retailer: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='retailer')
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='clicks')
    uniqueUsers: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='uniqueUsers')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_analytics_daily_clicks_day', 'day'),
        Index('ix_analytics_daily_clicks_productId', 'productId'),
    )
