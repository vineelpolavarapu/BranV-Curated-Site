import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Known settings + their default values. Add new tunables here so the admin
 * UI knows what to render. Values from DB override these.
 */
export const SETTING_DEFAULTS: Record<string, unknown> = {
  PRICE_SYNC_DRIFT_THRESHOLD_PCT: 5,
  NEW_ARRIVAL_DAYS: 30,
  BASE_CURRENCY: 'INR',
  ANALYTICS_ESTIMATED_RATE_PCT: 5,
  GOOGLE_OAUTH_ENABLED: false,
  WEB_PUSH_ENABLED: false,
  SMS_ENABLED: false,
};

const CACHE_TTL_MS = 30_000;

@Injectable()
export class SettingsService {
  // Single-instance in-process cache. The API runs on one node, so there is
  // no cross-instance invalidation to worry about; upsert() clears locally.
  private cache: { value: Record<string, unknown>; expiresAt: number } | null =
    null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listAll(): Promise<Record<string, unknown>> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.value;
    }

    const rows = await this.prisma.platformSetting.findMany();
    const merged: Record<string, unknown> = { ...SETTING_DEFAULTS };
    for (const row of rows) merged[row.key] = row.valueJson;

    this.cache = { value: merged, expiresAt: Date.now() + CACHE_TTL_MS };
    return merged;
  }

  async get<T = unknown>(key: string): Promise<T> {
    const all = await this.listAll();
    return (key in all ? all[key] : SETTING_DEFAULTS[key]) as T;
  }

  async upsert(key: string, value: unknown, actorId: string) {
    if (!(key in SETTING_DEFAULTS)) {
      // Reject unknown keys so the API surface stays explicit.
      throw new Error(`Unknown setting key: ${key}`);
    }
    const row = await this.prisma.platformSetting.upsert({
      where: { key },
      create: {
        key,
        valueJson: value as Prisma.InputJsonValue,
        updatedById: actorId,
      },
      update: {
        valueJson: value as Prisma.InputJsonValue,
        updatedById: actorId,
      },
    });
    // Invalidate — next read fetches fresh (TTL would otherwise be ≤30s).
    this.cache = null;

    await this.audit.record({
      actorId,
      action: 'settings.update',
      targetType: 'platform_setting',
      targetId: key,
      metadata: { key, value: value as Prisma.InputJsonValue },
    });
    return row;
  }
}
