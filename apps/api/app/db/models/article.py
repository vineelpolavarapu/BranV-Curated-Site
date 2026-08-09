"""
Auto-generated from Prisma model `Article`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import ARRAY, Enum as SAEnum, Index, Integer, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from ..enums import ArticleStatus

from .base import Base


class Article(Base):
    __tablename__ = 'articles'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='slug')
    title: Mapped[str] = mapped_column(Text, nullable=False, name='title')
    heroUrl: Mapped[str | None] = mapped_column(Text, nullable=True, name='heroUrl')
    excerpt: Mapped[str | None] = mapped_column(Text, nullable=True, name='excerpt')
    bodyMd: Mapped[str] = mapped_column(Text, nullable=False, server_default=text('""'), name='bodyMd')
    status: Mapped[ArticleStatus] = mapped_column(SAEnum(ArticleStatus, name="ArticleStatus", create_type=False, native_enum=True), nullable=False, server_default=text('DRAFT'), name='status')
    scheduledAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='scheduledAt')
    publishedAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='publishedAt')
    authorId: Mapped[str | None] = mapped_column(Text, nullable=True, name='authorId')
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=True, server_default=text("'{}'"), name='tags')
    metaTitle: Mapped[str | None] = mapped_column(Text, nullable=True, name='metaTitle')
    metaDescription: Mapped[str | None] = mapped_column(Text, nullable=True, name='metaDescription')
    ogImage: Mapped[str | None] = mapped_column(Text, nullable=True, name='ogImage')
    readingMinutes: Mapped[int | None] = mapped_column(Integer, nullable=True, name='readingMinutes')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    __table_args__ = (
        Index('ix_articles_status_publishedAt', 'status', 'publishedAt'),
        Index('ix_articles_scheduledAt', 'scheduledAt'),
    )
