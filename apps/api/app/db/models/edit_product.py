"""
Auto-generated from Prisma model `EditProduct`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Index, Integer, TIMESTAMP, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class EditProduct(Base):
    __tablename__ = 'edit_products'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    editId: Mapped[str] = mapped_column(Text, nullable=False, name='editId')
    productId: Mapped[str] = mapped_column(Text, nullable=False, name='productId')
    position: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='position')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')

    __table_args__ = (
        Index('ix_edit_products_editId', 'editId'),
        UniqueConstraint('editId', 'productId', name='uq_edit_products_editId_productId'),
    )
