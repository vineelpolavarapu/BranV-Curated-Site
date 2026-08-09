"""
Auto-generated from Prisma model `PlatformSetting`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import TIMESTAMP, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class PlatformSetting(Base):
    __tablename__ = 'platform_settings'
    key: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='key')
    valueJson: Mapped[Any] = mapped_column(JSONB, nullable=False, name='valueJson')
    updatedById: Mapped[str | None] = mapped_column(Text, nullable=True, name='updatedById')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')
