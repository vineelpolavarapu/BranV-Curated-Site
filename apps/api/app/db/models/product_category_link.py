"""
Product ⇄ Category many-to-many visibility links.

Backs the admin product form's "Product Visibility - select categories this
product appears in" checkboxes. A product's primary placement is still its
single `categoryId`/`subcategoryId`; rows here add *extra* category/collection
landing pages the product should also surface on. See migration
`20260831210000_add_product_category_links`.

Hand-written (not part of the Prisma schema snapshot) - the table is created by
the raw SQL migration above and consumed only by the SQLAlchemy runtime.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Index, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ProductCategoryLink(Base):
    __tablename__ = 'product_category_links'
    productId: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='productId')
    categoryId: Mapped[str] = mapped_column(Text, primary_key=True, nullable=False, name='categoryId')
    createdAt: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), nullable=False,
        server_default=text('CURRENT_TIMESTAMP'), name='createdAt',
    )

    __table_args__ = (
        Index('ix_product_category_links_categoryId', 'categoryId'),
    )
