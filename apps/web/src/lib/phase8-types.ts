export type ReviewStatus = 'PUBLISHED' | 'HIDDEN';

export type NotificationChannel = 'EMAIL' | 'IN_APP' | 'WEB_PUSH' | 'SMS';
export type NotificationType =
  | 'WELCOME'
  | 'WISHLIST_PRICE_DROP'
  | 'DROP_LAUNCHING_SOON'
  | 'DROP_LIVE'
  | 'NEW_ARTICLE'
  | 'REVIEW_HIDDEN'
  | 'ADMIN_SYNC_FAILURE'
  | 'ADMIN_WEEKLY_SUMMARY'
  | 'GENERIC';

export interface ReviewPublic {
  id: string;
  productId: string;
  rating: number;
  title: string | null;
  body: string | null;
  images: string[];
  status: ReviewStatus;
  createdAt: string;
  author: { id: string; displayName: string };
}

export interface ReviewsPage {
  data: ReviewPublic[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Reviewability {
  canReview: boolean;
  hasWardrobeItem: boolean;
  ownReview: ReviewPublic | null;
}

export interface AdminReviewRow extends ReviewPublic {
  moderationReason: string | null;
  moderatedAt: string | null;
  product: { id: string; slug: string; title: string };
  user: {
    id: string;
    email: string;
    profile: { firstName: string | null; lastName: string | null } | null;
  };
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  payload: {
    title?: string;
    body?: string;
    link?: string;
    [k: string]: unknown;
  };
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  data: NotificationItem[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface NotificationPreference {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface NewsletterSubscriberRow {
  id: string;
  email: string;
  status: 'PENDING' | 'CONFIRMED' | 'UNSUBSCRIBED';
  source: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
}
