"""
Auto-generated from Prisma model `WishlistItem`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Index, TIMESTAMP, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class WishlistItem(Base):
    __tablename__ = 'wishlist_items'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    userId: Mapped[str] = mapped_column(Text, nullable=False, name='userId')
    productId: Mapped[str] = mapped_column(Text, nullable=False, name='productId')
    notifyOnPriceDrop: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('false'), name='notifyOnPriceDrop')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_wishlist_items_userId_createdAt', 'userId', 'createdAt'),
        UniqueConstraint('userId', 'productId', name='uq_wishlist_items_userId_productId'),
    )
