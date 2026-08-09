"""
Auto-generated from Prisma model `Brand`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Enum as SAEnum, Index, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import BrandStatus

from .base import Base


class Brand(Base):
    __tablename__ = 'brands'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='slug')
    name: Mapped[str] = mapped_column(Text, nullable=False, name='name')
    logoUrl: Mapped[str | None] = mapped_column(Text, nullable=True, name='logoUrl')
    heroUrl: Mapped[str | None] = mapped_column(Text, nullable=True, name='heroUrl')
    description: Mapped[str | None] = mapped_column(Text, nullable=True, name='description')
    isFeatured: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('false'), name='isFeatured')
    status: Mapped[BrandStatus] = mapped_column(SAEnum(BrandStatus, name="BrandStatus", create_type=False, native_enum=True), nullable=False, server_default=text('ACTIVE'), name='status')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_brands_status_isFeatured', 'status', 'isFeatured'),
    )
