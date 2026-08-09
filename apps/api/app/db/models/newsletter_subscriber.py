"""
Auto-generated from Prisma model `NewsletterSubscriber`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Enum as SAEnum, Index, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import NewsletterStatus

from .base import Base


class NewsletterSubscriber(Base):
    __tablename__ = 'newsletter_subscribers'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='email')
    userId: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True, name='userId')
    source: Mapped[str | None] = mapped_column(Text, nullable=True, name='source')
    status: Mapped[NewsletterStatus] = mapped_column(SAEnum(NewsletterStatus, name="NewsletterStatus", create_type=False, native_enum=True), nullable=False, server_default=text('PENDING'), name='status')
    confirmationTokenHash: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True, name='confirmationTokenHash')
    unsubscribeTokenHash: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='unsubscribeTokenHash')
    confirmedAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='confirmedAt')
    unsubscribedAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='unsubscribedAt')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_newsletter_subscribers_status', 'status'),
    )
