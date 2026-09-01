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
