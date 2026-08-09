"""
Auto-generated from Prisma model `Review`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Enum as SAEnum, Index, Integer, TIMESTAMP, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import ReviewStatus

from .base import Base


class Review(Base):
    __tablename__ = 'reviews'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    productId: Mapped[str] = mapped_column(Text, nullable=False, name='productId')
    userId: Mapped[str] = mapped_column(Text, nullable=False, name='userId')
    rating: Mapped[int] = mapped_column(Integer, nullable=False, name='rating')
    title: Mapped[str | None] = mapped_column(Text, nullable=True, name='title')
    body: Mapped[str | None] = mapped_column(Text, nullable=True, name='body')
    imagesJson: Mapped[Any | None] = mapped_column(JSONB, nullable=True, name='imagesJson')
    status: Mapped[ReviewStatus] = mapped_column(SAEnum(ReviewStatus, name="ReviewStatus", create_type=False, native_enum=True), nullable=False, server_default=text('PUBLISHED'), name='status')
    moderationReason: Mapped[str | None] = mapped_column(Text, nullable=True, name='moderationReason')
    moderatedById: Mapped[str | None] = mapped_column(Text, nullable=True, name='moderatedById')
    moderatedAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='moderatedAt')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_reviews_productId_status_createdAt', 'productId', 'status', 'createdAt'),
        Index('ix_reviews_userId', 'userId'),
        UniqueConstraint('productId', 'userId', name='uq_reviews_productId_userId'),
    )
