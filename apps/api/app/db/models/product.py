"""
Auto-generated from Prisma model `Product`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import ARRAY, Enum as SAEnum, Index, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import ProductStatus

from .base import Base


class Product(Base):
    __tablename__ = 'products'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    brandId: Mapped[str] = mapped_column(Text, nullable=False, name='brandId')
    categoryId: Mapped[str] = mapped_column(Text, nullable=False, name='categoryId')
    subcategoryId: Mapped[str | None] = mapped_column(Text, nullable=True, name='subcategoryId')
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='slug')
    title: Mapped[str] = mapped_column(Text, nullable=False, name='title')
    description: Mapped[str | None] = mapped_column(Text, nullable=True, name='description')
    primaryRetailer: Mapped[str | None] = mapped_column(Text, nullable=True, name='primaryRetailer')
    status: Mapped[ProductStatus] = mapped_column(SAEnum(ProductStatus, name="ProductStatus", create_type=False, native_enum=True), nullable=False, server_default=text('DRAFT'), name='status')
    createdByAdminId: Mapped[str | None] = mapped_column(Text, nullable=True, name='createdByAdminId')
    metaTitle: Mapped[str | None] = mapped_column(Text, nullable=True, name='metaTitle')
    metaDescription: Mapped[str | None] = mapped_column(Text, nullable=True, name='metaDescription')
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=True, server_default=text("'{}'"), name='tags')
    archivedAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='archivedAt')
    featuredUntil: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='featuredUntil')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_products_status', 'status'),
        Index('ix_products_brandId', 'brandId'),
        Index('ix_products_categoryId', 'categoryId'),
        Index('ix_products_subcategoryId', 'subcategoryId'),
        Index('ix_products_status_categoryId_createdAt', 'status', 'categoryId', 'createdAt'),
        Index('ix_products_status_brandId_createdAt', 'status', 'brandId', 'createdAt'),
        Index('ix_products_createdAt', 'createdAt'),
        Index('ix_products_featuredUntil', 'featuredUntil'),
    )
