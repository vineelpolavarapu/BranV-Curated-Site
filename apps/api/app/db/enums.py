"""
Generated from migration/contract/prisma-schema.snapshot.prisma.
Do NOT edit by hand — re-run scripts/generate_sa_models.py.
"""
from __future__ import annotations

from enum import Enum

class UserRole(str, Enum):
    MEMBER = 'MEMBER'
    ADMIN = 'ADMIN'

class UserStatus(str, Enum):
    ACTIVE = 'ACTIVE'
    SUSPENDED = 'SUSPENDED'
    DELETED = 'DELETED'

class BrandStatus(str, Enum):
    ACTIVE = 'ACTIVE'
    HIDDEN = 'HIDDEN'
    ARCHIVED = 'ARCHIVED'

class ProductStatus(str, Enum):
    DRAFT = 'DRAFT'
    ACTIVE = 'ACTIVE'
    ARCHIVED = 'ARCHIVED'

class AvailabilityStatus(str, Enum):
    IN_STOCK = 'IN_STOCK'
    OUT_OF_STOCK_AT_RETAILER = 'OUT_OF_STOCK_AT_RETAILER'
    DELISTED = 'DELISTED'

class FilterType(str, Enum):
    SELECT = 'SELECT'
    MULTI_SELECT = 'MULTI_SELECT'
    RANGE = 'RANGE'
    TOGGLE = 'TOGGLE'

class AffiliatePartner(str, Enum):
    CUELINKS = 'CUELINKS'
    AMAZON = 'AMAZON'
    EARNKARO = 'EARNKARO'
    MEESHO = 'MEESHO'
    DIRECT = 'DIRECT'

class ClickReportOutcome(str, Enum):
    PURCHASED = 'PURCHASED'
    BROWSING = 'BROWSING'
    NEEDS_HELP = 'NEEDS_HELP'

class ArticleStatus(str, Enum):
    DRAFT = 'DRAFT'
    SCHEDULED = 'SCHEDULED'
    PUBLISHED = 'PUBLISHED'
    ARCHIVED = 'ARCHIVED'

class LookbookStatus(str, Enum):
    DRAFT = 'DRAFT'
    PUBLISHED = 'PUBLISHED'
    ARCHIVED = 'ARCHIVED'

class EditStatus(str, Enum):
    DRAFT = 'DRAFT'
    PUBLISHED = 'PUBLISHED'
    ARCHIVED = 'ARCHIVED'

class HomeBannerStatus(str, Enum):
    ACTIVE = 'ACTIVE'
    HIDDEN = 'HIDDEN'

class BrandStoryStatus(str, Enum):
    DRAFT = 'DRAFT'
    PUBLISHED = 'PUBLISHED'

class ReviewStatus(str, Enum):
    PUBLISHED = 'PUBLISHED'
    HIDDEN = 'HIDDEN'

class NewsletterStatus(str, Enum):
    PENDING = 'PENDING'
    CONFIRMED = 'CONFIRMED'
    UNSUBSCRIBED = 'UNSUBSCRIBED'

class NotificationChannel(str, Enum):
    EMAIL = 'EMAIL'
    IN_APP = 'IN_APP'
    WEB_PUSH = 'WEB_PUSH'
    SMS = 'SMS'

class NotificationType(str, Enum):
    WELCOME = 'WELCOME'
    WISHLIST_PRICE_DROP = 'WISHLIST_PRICE_DROP'
    DROP_LAUNCHING_SOON = 'DROP_LAUNCHING_SOON'
    DROP_LIVE = 'DROP_LIVE'
    NEW_ARTICLE = 'NEW_ARTICLE'
    REVIEW_HIDDEN = 'REVIEW_HIDDEN'
    ADMIN_SYNC_FAILURE = 'ADMIN_SYNC_FAILURE'
    ADMIN_WEEKLY_SUMMARY = 'ADMIN_WEEKLY_SUMMARY'
    GENERIC = 'GENERIC'

class OutboxStatus(str, Enum):
    PENDING = 'PENDING'
    DISPATCHED = 'DISPATCHED'
    FAILED = 'FAILED'

class AffiliatePayoutItemStatus(str, Enum):
    MATCHED = 'MATCHED'
    UNMATCHED = 'UNMATCHED'
    AMBIGUOUS = 'AMBIGUOUS'
