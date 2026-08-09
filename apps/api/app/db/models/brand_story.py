"""
Auto-generated from Prisma model `BrandStory`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Enum as SAEnum, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import BrandStoryStatus

from .base import Base


class BrandStory(Base):
    __tablename__ = 'brand_stories'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    brandId: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='brandId')
    heroUrl: Mapped[str | None] = mapped_column(Text, nullable=True, name='heroUrl')
    bodyMd: Mapped[str] = mapped_column(Text, nullable=False, server_default=text('""'), name='bodyMd')
    status: Mapped[BrandStoryStatus] = mapped_column(SAEnum(BrandStoryStatus, name="BrandStoryStatus", create_type=False, native_enum=True), nullable=False, server_default=text('DRAFT'), name='status')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')
