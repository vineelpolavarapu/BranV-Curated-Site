import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  NotificationChannel,
  NotificationType,
  OutboxStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface EnqueueInput {
  /** Either `userId` (member-targeted) or `email` (anonymous newsletter, etc). */
  userId?: string | null;
  email?: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  /** Free-form payload — `{ title, body, link, ... }`. Stored as JSONB. */
  payload: Record<string, unknown>;
  /** Optional future-dated dispatch. Defaults to now (immediate). */
  scheduledFor?: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an outbox row inside the supplied transaction client (or the global
   * Prisma client if none provided). The dispatcher cron picks it up.
   */
  async enqueue(
    input: EnqueueInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (!input.userId && !input.email) {
      throw new Error('enqueue() requires either userId or email');
    }
    const client = tx ?? this.prisma;
    await client.notificationOutbox.create({
      data: {
        userId: input.userId ?? null,
        email: input.email ?? null,
        type: input.type,
        channel: input.channel,
        payload: input.payload as Prisma.InputJsonValue,
        scheduledFor: input.scheduledFor ?? new Date(),
      },
    });
  }

  /**
   * Enqueue the same notification to both IN_APP and EMAIL channels for a
   * member, honoring their preferences. Anonymous (email-only) targets get
   * EMAIL only — no in-app inbox without a user record.
   */
  async enqueueMultiChannel(input: {
    userId?: string | null;
    email?: string | null;
    type: NotificationType;
    payload: Record<string, unknown>;
  }) {
    const channels: NotificationChannel[] = input.userId
      ? [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
      : [NotificationChannel.EMAIL];

    for (const channel of channels) {
      if (input.userId) {
        const allowed = await this.isEnabled(
          input.userId,
          input.type,
          channel,
        );
        if (!allowed) continue;
      }
      await this.enqueue({ ...input, channel });
    }
  }

  /**
   * Returns the user's preference for (type, channel). Default = ENABLED so
   * new types start visible until the member opts out.
   */
  async isEnabled(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_type_channel: { userId, type, channel } },
    });
    return pref ? pref.enabled : true;
  }

  // ──────────────────────── Member-facing reads ────────────────────────

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
    unreadOnly: boolean,
  ) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      channel: NotificationChannel.IN_APP,
    };
    if (unreadOnly) where.readAt = null;
    const [total, unread, data] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, channel: NotificationChannel.IN_APP, readAt: null },
      }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      data,
      total,
      unread,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        channel: NotificationChannel.IN_APP,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        channel: NotificationChannel.IN_APP,
        readAt: null,
      },
    });
  }

  // ──────────────────────── Preferences ────────────────────────

  async listPreferences(userId: string) {
    return this.prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { channel: 'asc' }],
    });
  }

  async upsertPreference(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
    enabled: boolean,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_type_channel: { userId, type, channel } },
      create: { userId, type, channel, enabled },
      update: { enabled },
    });
  }

  // ──────────────────────── Dispatcher helpers ────────────────────────

  async claimPending(limit: number) {
    return this.prisma.notificationOutbox.findMany({
      where: {
        status: OutboxStatus.PENDING,
        scheduledFor: { lte: new Date() },
      },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
    });
  }

  async markDispatched(id: string) {
    await this.prisma.notificationOutbox.update({
      where: { id },
      data: { status: OutboxStatus.DISPATCHED, dispatchedAt: new Date() },
    });
  }

  async markFailed(id: string, attempts: number, error: string) {
    // Exponential-ish backoff capped at 30 min. After 5 attempts → FAILED.
    const status =
      attempts >= 5 ? OutboxStatus.FAILED : OutboxStatus.PENDING;
    const backoffMin = Math.min(30, Math.pow(2, attempts));
    await this.prisma.notificationOutbox.update({
      where: { id },
      data: {
        status,
        attempts: attempts + 1,
        lastError: error,
        scheduledFor: new Date(Date.now() + backoffMin * 60 * 1000),
      },
    });
  }

  /** Inserts the in-app row that powers the bell icon. */
  async insertInAppRow(
    userId: string,
    type: NotificationType,
    payload: Record<string, unknown>,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        channel: NotificationChannel.IN_APP,
        payload: payload as Prisma.InputJsonValue,
        sentAt: new Date(),
      },
    });
  }
}
