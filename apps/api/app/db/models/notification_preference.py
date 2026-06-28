"""
Auto-generated from Prisma model `NotificationPreference`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Enum as SAEnum, Index, TIMESTAMP, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import NotificationChannel, NotificationType

from .base import Base


class NotificationPreference(Base):
    __tablename__ = 'notification_preferences'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    userId: Mapped[str] = mapped_column(Text, nullable=False, name='userId')
    type_: Mapped[NotificationType] = mapped_column(SAEnum(NotificationType, name="NotificationType", create_type=False, native_enum=True), nullable=False, name='type')
    channel: Mapped[NotificationChannel] = mapped_column(SAEnum(NotificationChannel, name="NotificationChannel", create_type=False, native_enum=True), nullable=False, name='channel')
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('true'), name='enabled')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_notification_preferences_userId', 'userId'),
        UniqueConstraint('userId', 'type', 'channel', name='uq_notification_preferences_userId_type_channel'),
    )
