"""
Auto-generated from Prisma model `ProductCategoryLink`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Index, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ProductCategoryLink(Base):
    __tablename__ = 'product_category_links'
    productId: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='productId')
    categoryId: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='categoryId')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')

    __table_args__ = (
        Index('ix_product_category_links_categoryId', 'categoryId'),
    )
