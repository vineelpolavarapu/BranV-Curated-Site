"""
Auto-generated from Prisma model `MemberProfile`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand - re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user import User


class MemberProfile(Base):
    __tablename__ = 'member_profiles'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    userId: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='userId')
    firstName: Mapped[str | None] = mapped_column(Text, nullable=True, name='firstName')
    lastName: Mapped[str | None] = mapped_column(Text, nullable=True, name='lastName')
    phone: Mapped[str | None] = mapped_column(Text, nullable=True, name='phone')
    dob: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='dob')
    avatarUrl: Mapped[str | None] = mapped_column(Text, nullable=True, name='avatarUrl')
    tier: Mapped[str | None] = mapped_column(Text, nullable=True, name='tier')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    # ── Relationships (hand-added; the generator emits scalar columns only) ──
    # See the note in user.py: re-running the model generator drops this block.
    user: Mapped[User | None] = relationship(
        "User",
        primaryjoin="foreign(MemberProfile.userId) == User.id_",
        uselist=False,
        back_populates="profile",
    )
