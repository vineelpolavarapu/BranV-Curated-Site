"""
Auto-generated from Prisma model `SelfReportedConversion`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Enum as SAEnum, Index, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import ClickReportOutcome

from .base import Base


class SelfReportedConversion(Base):
    __tablename__ = 'self_reported_conversions'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    clickEventId: Mapped[str] = mapped_column(Text, nullable=False, name='clickEventId')
    userId: Mapped[str | None] = mapped_column(Text, nullable=True, name='userId')
    outcome: Mapped[ClickReportOutcome] = mapped_column(SAEnum(ClickReportOutcome, name="ClickReportOutcome", create_type=False, native_enum=True), nullable=False, name='outcome')
    reportedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='reportedAt')

    __table_args__ = (
        Index('ix_self_reported_conversions_clickEventId', 'clickEventId'),
        Index('ix_self_reported_conversions_userId', 'userId'),
        Index('ix_self_reported_conversions_outcome', 'outcome'),
    )
