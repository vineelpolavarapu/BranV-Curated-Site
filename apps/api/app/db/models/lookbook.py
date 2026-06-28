"""
Auto-generated from Prisma model `Lookbook`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Enum as SAEnum, Index, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import LookbookStatus

from .base import Base


class Lookbook(Base):
    __tablename__ = 'lookbooks'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='slug')
    title: Mapped[str] = mapped_column(Text, nullable=False, name='title')
    heroUrl: Mapped[str | None] = mapped_column(Text, nullable=True, name='heroUrl')
    description: Mapped[str | None] = mapped_column(Text, nullable=True, name='description')
    status: Mapped[LookbookStatus] = mapped_column(SAEnum(LookbookStatus, name="LookbookStatus", create_type=False, native_enum=True), nullable=False, server_default=text('DRAFT'), name='status')
    publishedAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='publishedAt')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_lookbooks_status', 'status'),
    )
