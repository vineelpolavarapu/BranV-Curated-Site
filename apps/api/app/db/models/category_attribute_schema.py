"""
Auto-generated from Prisma model `CategoryAttributeSchema`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Enum as SAEnum, Index, Integer, TIMESTAMP, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import FilterType

from .base import Base


class CategoryAttributeSchema(Base):
    __tablename__ = 'category_attribute_schemas'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    categoryId: Mapped[str] = mapped_column(Text, nullable=False, name='categoryId')
    attributeKey: Mapped[str] = mapped_column(Text, nullable=False, name='attributeKey')
    displayName: Mapped[str] = mapped_column(Text, nullable=False, name='displayName')
    filterType: Mapped[FilterType] = mapped_column(SAEnum(FilterType, name="FilterType", create_type=False, native_enum=True), nullable=False, server_default=text('SELECT'), name='filterType')
    optionsJson: Mapped[Any | None] = mapped_column(JSONB, nullable=True, name='optionsJson')
    displayOrder: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='displayOrder')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        UniqueConstraint('categoryId', 'attributeKey', name='uq_category_attribute_schemas_categoryId_attributeKey'),
    )
