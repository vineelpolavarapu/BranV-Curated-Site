"""
Auto-generated from Prisma model `Notification`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Enum as SAEnum, Index, TIMESTAMP, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import NotificationChannel, NotificationType

from .base import Base


class Notification(Base):
    __tablename__ = 'notifications'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    userId: Mapped[str] = mapped_column(Text, nullable=False, name='userId')
    type_: Mapped[NotificationType] = mapped_column(SAEnum(NotificationType, name="NotificationType", create_type=False, native_enum=True), nullable=False, name='type')
    channel: Mapped[NotificationChannel] = mapped_column(SAEnum(NotificationChannel, name="NotificationChannel", create_type=False, native_enum=True), nullable=False, server_default=text('IN_APP'), name='channel')
    payload: Mapped[Any] = mapped_column(JSONB, nullable=False, name='payload')
    readAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='readAt')
    sentAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='sentAt')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')

    __table_args__ = (
        Index('ix_notifications_userId_readAt', 'userId', 'readAt'),
        Index('ix_notifications_userId_createdAt', 'userId', 'createdAt'),
    )
