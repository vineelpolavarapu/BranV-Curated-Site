import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  /** Accept input-JSON (callers often pass DTOs or Prisma scalars). */
  metadata?: Prisma.InputJsonValue;
}

export interface AuditListQuery {
  page: number;
  pageSize: number;
  actorId?: string;
  action?: string;
  targetType?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget audit write. Never throws — audit must not block the caller. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          ip: entry.ip,
          userAgent: entry.userAgent,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record audit log: ${(err as Error).message}`,
      );
    }
  }

  async list(q: AuditListQuery) {
    const where: Prisma.AuditLogWhereInput = {};
    if (q.actorId) where.actorId = q.actorId;
    if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
    if (q.targetType) where.targetType = q.targetType;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = q.from;
      if (q.to) where.createdAt.lte = q.to;
    }
    const [total, data, distinctActions] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      // Distinct action names — small set, fine to scan; populates the filter dropdown.
      this.prisma.auditLog.findMany({
        distinct: ['action'],
        orderBy: { action: 'asc' },
        select: { action: true },
        take: 100,
      }),
    ]);
    return {
      data,
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      actions: distinctActions.map((a) => a.action),
    };
  }
}
