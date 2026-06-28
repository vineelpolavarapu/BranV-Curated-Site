"""
Auto-generated from Prisma model `Category`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Index, Integer, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Category(Base):
    __tablename__ = 'categories'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    parentId: Mapped[str | None] = mapped_column(Text, nullable=True, name='parentId')
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='slug')
    name: Mapped[str] = mapped_column(Text, nullable=False, name='name')
    path: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='path')
    displayOrder: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='displayOrder')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_categories_parentId', 'parentId'),
    )
