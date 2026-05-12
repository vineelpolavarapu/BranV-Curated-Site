/**
 * @branv/shared — types shared between apps/web and apps/api.
 *
 * Phase 0: empty. Domain types (User, Product, Brand, etc.) land in later phases.
 */

export const BRANV_VERSION = '0.1.0' as const;

export type HealthCheckStatus = 'ok' | 'degraded' | 'down';

export interface HealthResponse {
  status: 'ok';
  uptime: number;
  version: string;
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  checks: Record<
    string,
    { ok: boolean; latencyMs?: number; error?: string }
  >;
  timestamp: string;
}
