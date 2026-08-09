"""
Auto-generated from Prisma model `ProductImage`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Index, Integer, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ProductImage(Base):
    __tablename__ = 'product_images'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    productId: Mapped[str] = mapped_column(Text, nullable=False, name='productId')
    url: Mapped[str] = mapped_column(Text, nullable=False, name='url')
    altText: Mapped[str | None] = mapped_column(Text, nullable=True, name='altText')
    isPrimary: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('false'), name='isPrimary')
    isAiGenerated: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('false'), name='isAiGenerated')
    position: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='position')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')

    __table_args__ = (
        Index('ix_product_images_productId', 'productId'),
        Index('ix_product_images_productId_isPrimary', 'productId', 'isPrimary'),
    )
