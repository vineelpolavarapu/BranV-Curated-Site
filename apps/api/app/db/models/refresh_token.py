"""
Auto-generated from Prisma model `RefreshToken`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Index, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class RefreshToken(Base):
    __tablename__ = 'refresh_tokens'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    userId: Mapped[str] = mapped_column(Text, nullable=False, name='userId')
    tokenHash: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='tokenHash')
    expiresAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, name='expiresAt')
    revokedAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='revokedAt')
    replacedById: Mapped[str | None] = mapped_column(Text, nullable=True, name='replacedById')
    ip: Mapped[str | None] = mapped_column(Text, nullable=True, name='ip')
    userAgent: Mapped[str | None] = mapped_column(Text, nullable=True, name='userAgent')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')

    __table_args__ = (
        Index('ix_refresh_tokens_userId', 'userId'),
    )
