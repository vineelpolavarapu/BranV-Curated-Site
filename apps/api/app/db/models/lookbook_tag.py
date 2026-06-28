"""
Auto-generated from Prisma model `LookbookTag`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Index, Numeric, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class LookbookTag(Base):
    __tablename__ = 'lookbook_tags'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    lookbookImageId: Mapped[str] = mapped_column(Text, nullable=False, name='lookbookImageId')
    productId: Mapped[str] = mapped_column(Text, nullable=False, name='productId')
    xPercent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, name='xPercent')
    yPercent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, name='yPercent')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')

    __table_args__ = (
        Index('ix_lookbook_tags_lookbookImageId', 'lookbookImageId'),
    )
