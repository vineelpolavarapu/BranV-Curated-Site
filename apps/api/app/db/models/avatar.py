"""
Auto-generated from Prisma model `Avatar`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import ARRAY, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Avatar(Base):
    __tablename__ = 'avatars'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    name: Mapped[str] = mapped_column(Text, nullable=False, name='name')
    referenceImageUrl: Mapped[str] = mapped_column(Text, nullable=False, name='referenceImageUrl')
    promptTemplate: Mapped[str] = mapped_column(Text, nullable=False, name='promptTemplate')
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=True, server_default=text("'{}'"), name='tags')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')
