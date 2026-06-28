"""
Auto-generated from Prisma model `ProductRetailerListing`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Enum as SAEnum, Index, Integer, Numeric, TIMESTAMP, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import AvailabilityStatus

from .base import Base


class ProductRetailerListing(Base):
    __tablename__ = 'product_retailer_listings'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    productId: Mapped[str] = mapped_column(Text, nullable=False, name='productId')
    retailer: Mapped[str] = mapped_column(Text, nullable=False, name='retailer')
    retailerProductUrl: Mapped[str] = mapped_column(Text, nullable=False, name='retailerProductUrl')
    retailerImageUrl: Mapped[str | None] = mapped_column(Text, nullable=True, name='retailerImageUrl')
    rawPrice: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True, name='rawPrice')
    lastSyncedAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='lastSyncedAt')
    syncFailedCount: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='syncFailedCount')
    syncFailedSince: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='syncFailedSince')
    availabilityStatus: Mapped[AvailabilityStatus] = mapped_column(SAEnum(AvailabilityStatus, name="AvailabilityStatus", create_type=False, native_enum=True), nullable=False, server_default=text('IN_STOCK'), name='availabilityStatus')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_product_retailer_listings_retailer', 'retailer'),
        UniqueConstraint('productId', 'retailer', name='uq_product_retailer_listings_productId_retailer'),
    )
