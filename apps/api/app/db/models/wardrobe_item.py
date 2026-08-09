"""
Auto-generated from Prisma model `WardrobeItem`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import ARRAY, Index, Numeric, TIMESTAMP, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class WardrobeItem(Base):
    __tablename__ = 'wardrobe_items'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    userId: Mapped[str] = mapped_column(Text, nullable=False, name='userId')
    productId: Mapped[str] = mapped_column(Text, nullable=False, name='productId')
    retailer: Mapped[str] = mapped_column(Text, nullable=False, name='retailer')
    clickEventId: Mapped[str | None] = mapped_column(Text, nullable=True, name='clickEventId')
    selfReportedPrice: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True, name='selfReportedPrice')
    selfReportedDate: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='selfReportedDate')
    notes: Mapped[str | None] = mapped_column(Text, nullable=True, name='notes')
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=True, server_default=text("'{}'"), name='tags')
    removedAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='removedAt')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_wardrobe_items_userId_createdAt', 'userId', 'createdAt'),
        UniqueConstraint('userId', 'productId', name='uq_wardrobe_items_userId_productId'),
    )
