import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  NotificationChannel,
  NotificationOutbox,
} from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { MailService } from '../mail/mail.service';

const BATCH_SIZE = 25;

@Injectable()
export class NotificationsDispatcher {
  private readonly logger = new Logger(NotificationsDispatcher.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  /**
   * Pumps the outbox every 15 seconds. Each item is dispatched once per call;
   * failures bounce back to PENDING with backoff via NotificationsService.
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async pump() {
    let batch: NotificationOutbox[];
    try {
      batch = await this.notifications.claimPending(BATCH_SIZE);
    } catch (err) {
      this.logger.error(
        `outbox claim failed: ${(err as Error).message}`,
      );
      return;
    }
    if (batch.length === 0) return;

    for (const row of batch) {
      try {
        await this.dispatch(row);
        await this.notifications.markDispatched(row.id);
      } catch (err) {
        await this.notifications.markFailed(
          row.id,
          row.attempts,
          (err as Error).message ?? 'unknown',
        );
        this.logger.warn(
          `dispatch failed (${row.type}/${row.channel}) row=${row.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async dispatch(row: NotificationOutbox) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const subject = (payload.title as string) ?? 'Notification from BranV';
    const body = (payload.body as string) ?? '';
    const link = payload.link as string | undefined;

    switch (row.channel) {
      case NotificationChannel.IN_APP: {
        if (!row.userId) {
          throw new Error('IN_APP dispatch requires userId');
        }
        await this.notifications.insertInAppRow(row.userId, row.type, payload);
        return;
      }
      case NotificationChannel.EMAIL: {
        const to = row.email ?? (payload.email as string | undefined);
        if (!to) throw new Error('EMAIL dispatch requires recipient');
        await this.mail.send({
          to,
          subject,
          text: link ? `${body}\n\n${link}` : body,
        });
        return;
      }
      case NotificationChannel.WEB_PUSH:
      case NotificationChannel.SMS:
        // Feature-flagged off at launch (BUILD_GUIDE §8.3 / PRD §15.1).
        // Mark dispatched (no-op) so it doesn't loop forever.
        return;
    }
  }
}
