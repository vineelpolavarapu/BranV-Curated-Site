"""
Auto-generated from Prisma model `NotificationOutbox`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Enum as SAEnum, Index, Integer, TIMESTAMP, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import NotificationChannel, OutboxStatus

from .base import Base


class NotificationOutbox(Base):
    __tablename__ = 'notification_outbox'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    email: Mapped[str | None] = mapped_column(Text, nullable=True, name='email')
    channel: Mapped[NotificationChannel] = mapped_column(SAEnum(NotificationChannel, name="NotificationChannel", create_type=False, native_enum=True), nullable=False, name='channel')
    payload: Mapped[Any] = mapped_column(JSONB, nullable=False, name='payload')
    status: Mapped[OutboxStatus] = mapped_column(SAEnum(OutboxStatus, name="OutboxStatus", create_type=False, native_enum=True), nullable=False, server_default=text('PENDING'), name='status')
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='attempts')
    lastError: Mapped[str | None] = mapped_column(Text, nullable=True, name='lastError')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_notification_outbox_status', 'status'),
    )
