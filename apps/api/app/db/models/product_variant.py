"""
Auto-generated from Prisma model `ProductVariant`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, Index, TIMESTAMP, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ProductVariant(Base):
    __tablename__ = 'product_variants'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    productId: Mapped[str] = mapped_column(Text, nullable=False, name='productId')
    sku: Mapped[str | None] = mapped_column(Text, nullable=True, name='sku')
    attributes: Mapped[Any] = mapped_column(JSONB, nullable=False, server_default=text('"{}"'), name='attributes')
    color: Mapped[str | None] = mapped_column(Text, nullable=True, name='color')
    size: Mapped[str | None] = mapped_column(Text, nullable=True, name='size')
    isDefault: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('false'), name='isDefault')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_product_variants_productId', 'productId'),
    )
