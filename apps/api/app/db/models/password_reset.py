"""
Auto-generated from Prisma model `PasswordReset`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Index, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class PasswordReset(Base):
    __tablename__ = 'password_resets'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    userId: Mapped[str] = mapped_column(Text, nullable=False, name='userId')
    tokenHash: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='tokenHash')
    expiresAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, name='expiresAt')
    usedAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='usedAt')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')

    __table_args__ = (
        Index('ix_password_resets_userId', 'userId'),
    )
