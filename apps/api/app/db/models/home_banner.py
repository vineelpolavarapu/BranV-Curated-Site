"""
Auto-generated from Prisma model `HomeBanner`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Enum as SAEnum, Index, Integer, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import HomeBannerStatus

from .base import Base


class HomeBanner(Base):
    __tablename__ = 'home_banners'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    imageUrl: Mapped[str] = mapped_column(Text, nullable=False, name='imageUrl')
    headline: Mapped[str | None] = mapped_column(Text, nullable=True, name='headline')
    ctaLabel: Mapped[str | None] = mapped_column(Text, nullable=True, name='ctaLabel')
    ctaLink: Mapped[str | None] = mapped_column(Text, nullable=True, name='ctaLink')
    displayOrder: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='displayOrder')
    startsAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='startsAt')
    endsAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='endsAt')
    status: Mapped[HomeBannerStatus] = mapped_column(SAEnum(HomeBannerStatus, name="HomeBannerStatus", create_type=False, native_enum=True), nullable=False, server_default=text('ACTIVE'), name='status')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_home_banners_status_displayOrder', 'status', 'displayOrder'),
    )
