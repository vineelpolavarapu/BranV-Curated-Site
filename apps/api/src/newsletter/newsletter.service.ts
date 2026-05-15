import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsletterStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);
  private readonly webOrigin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.webOrigin =
      config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  }

  /**
   * Double-opt-in subscribe (BUILD_GUIDE §8.2 step 5): creates / refreshes
   * a PENDING subscriber and emails a confirmation link. Always succeeds —
   * we never leak whether an address is already on the list.
   */
  async subscribe(input: {
    email: string;
    source?: string;
    userId?: string | null;
  }): Promise<void> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existing && existing.status === NewsletterStatus.CONFIRMED) {
      // Already confirmed — no-op, return silently.
      return;
    }

    const rawConfirmationToken = nanoid(48);
    const rawUnsubscribeToken = existing
      ? null
      : nanoid(48);
    const confirmationTokenHash = sha256(rawConfirmationToken);
    const unsubscribeTokenHash = rawUnsubscribeToken
      ? sha256(rawUnsubscribeToken)
      : existing!.unsubscribeTokenHash;

    const upserted = await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        userId: input.userId ?? null,
        source: input.source,
        status: NewsletterStatus.PENDING,
        confirmationTokenHash,
        unsubscribeTokenHash,
      },
      update: {
        status: NewsletterStatus.PENDING,
        userId: input.userId ?? undefined,
        source: input.source ?? undefined,
        confirmationTokenHash,
        // Note: we deliberately don't rotate the unsubscribe token on resub
        // so existing email-footer links keep working.
      },
    });

    const confirmLink = `${this.webOrigin}/newsletter/confirm?token=${rawConfirmationToken}`;
    await this.mail.send({
      to: email,
      subject: 'Confirm your BranV newsletter signup',
      text: [
        'Welcome to BranV.',
        '',
        'Click the link below to confirm your subscription:',
        confirmLink,
        '',
        'If you didn’t sign up, just ignore this — you won’t be added.',
      ].join('\n'),
    });

    await this.audit.record({
      actorId: input.userId ?? null,
      action: 'newsletter.subscribe',
      targetType: 'newsletter_subscriber',
      targetId: upserted.id,
      metadata: { source: input.source ?? null },
    });
  }

  async confirm(rawToken: string) {
    const tokenHash = sha256(rawToken);
    const sub = await this.prisma.newsletterSubscriber.findUnique({
      where: { confirmationTokenHash: tokenHash },
    });
    if (!sub || sub.status === NewsletterStatus.UNSUBSCRIBED) {
      throw new BadRequestException('Invalid or expired confirmation link');
    }
    if (sub.status === NewsletterStatus.CONFIRMED) {
      return { alreadyConfirmed: true };
    }
    await this.prisma.newsletterSubscriber.update({
      where: { id: sub.id },
      data: {
        status: NewsletterStatus.CONFIRMED,
        confirmedAt: new Date(),
        confirmationTokenHash: null,
      },
    });
    await this.audit.record({
      actorId: sub.userId,
      action: 'newsletter.confirm',
      targetType: 'newsletter_subscriber',
      targetId: sub.id,
    });
    return { alreadyConfirmed: false };
  }

  async unsubscribe(rawToken: string) {
    const tokenHash = sha256(rawToken);
    const sub = await this.prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeTokenHash: tokenHash },
    });
    if (!sub) {
      throw new BadRequestException('Invalid unsubscribe link');
    }
    if (sub.status === NewsletterStatus.UNSUBSCRIBED) return;
    await this.prisma.newsletterSubscriber.update({
      where: { id: sub.id },
      data: {
        status: NewsletterStatus.UNSUBSCRIBED,
        unsubscribedAt: new Date(),
      },
    });
    await this.audit.record({
      actorId: sub.userId,
      action: 'newsletter.unsubscribe',
      targetType: 'newsletter_subscriber',
      targetId: sub.id,
    });
  }

  /** Admin: paginated list with counts per status. */
  async listAdmin(page: number, pageSize: number) {
    const [total, data, statusCounts] = await this.prisma.$transaction([
      this.prisma.newsletterSubscriber.count(),
      this.prisma.newsletterSubscriber.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          status: true,
          source: true,
          confirmedAt: true,
          unsubscribedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.newsletterSubscriber.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
    ]);
    const counts: Record<string, number> = {};
    for (const row of statusCounts) {
      const c = row._count;
      counts[row.status] =
        typeof c === 'object' && c !== null ? (c._all ?? 0) : 0;
    }
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      counts,
    };
  }
}
