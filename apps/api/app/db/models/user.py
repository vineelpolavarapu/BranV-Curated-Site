"""
Auto-generated from Prisma model `User`.
Source: migration/contract/prisma-schema.snapshot.prisma
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum, Integer, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..enums import UserRole, UserStatus

from .base import Base

if TYPE_CHECKING:
    from .member_profile import MemberProfile


class User(Base):
    __tablename__ = 'users'
    id_: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='id')
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False, name='email')
    passwordHash: Mapped[str] = mapped_column(Text, nullable=False, name='passwordHash')
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="UserRole", create_type=False, native_enum=True), nullable=False, server_default=text('MEMBER'), name='role')
    status: Mapped[UserStatus] = mapped_column(SAEnum(UserStatus, name="UserStatus", create_type=False, native_enum=True), nullable=False, server_default=text('ACTIVE'), name='status')
    emailVerifiedAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='emailVerifiedAt')
    totpSecret: Mapped[str | None] = mapped_column(Text, nullable=True, name='totpSecret')
    totpEnabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('false'), name='totpEnabled')
    failedLoginCount: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'), name='failedLoginCount')
    lockedUntil: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='lockedUntil')
    lastLoginAt: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=False), nullable=True, name='lastLoginAt')
    createdAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, server_default=text('CURRENT_TIMESTAMP'), name='createdAt')
    updatedAt: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False, onupdate=text('CURRENT_TIMESTAMP'), name='updatedAt')

    # ── Relationships (hand-added; the generator emits scalar columns only) ──
    profile: Mapped[MemberProfile | None] = relationship(
        "MemberProfile",
        primaryjoin="User.id_ == foreign(MemberProfile.userId)",
        uselist=False,
        lazy="noload",
        back_populates="user",
    )


