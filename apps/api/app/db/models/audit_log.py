"""
Auto-generated from Prisma model `AuditLog`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Index, TIMESTAMP, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    actorId: Mapped[str | None] = mapped_column(Text, nullable=True, name='actorId')
    action: Mapped[str] = mapped_column(Text, nullable=False, name='action')
    targetType: Mapped[str | None] = mapped_column(Text, nullable=True, name='targetType')
    targetId: Mapped[str | None] = mapped_column(Text, nullable=True, name='targetId')
    ip: Mapped[str | None] = mapped_column(Text, nullable=True, name='ip')
    userAgent: Mapped[str | None] = mapped_column(Text, nullable=True, name='userAgent')
    metadata_: Mapped[Any | None] = mapped_column(JSONB, nullable=True, name='metadata')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')

    __table_args__ = (
        Index('ix_audit_logs_actorId', 'actorId'),
        Index('ix_audit_logs_action', 'action'),
        Index('ix_audit_logs_createdAt', 'createdAt'),
    )
