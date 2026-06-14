import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  /** Max requests per `window` seconds. */
  limit: number;
  /** Window size in seconds. */
  window: number;
  /** Optional key prefix for grouping (e.g. "auth"). */
  prefix?: string;
}

/** Per-route rate limit metadata. Falls back to the auth defaults if unset. */
export const RateLimit = (opts: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, opts);

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-process fixed-window rate limiter, keyed by IP + route. Suitable for the
 * single-instance API deployment; per-IP buckets reset on the window edge.
 * Cloudflare's WAF rate-limit rule in front of /auth/* gives the second layer
 * of defense across instances (see deployment plan §Phase 5).
 *
 * PRD §18.3: 5 req/min/IP on auth endpoints by default.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  // Bound memory in case of high-cardinality keys (e.g. spoofed IPs).
  private readonly MAX_BUCKETS = 10_000;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const opts = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!opts) return true; // No metadata → no limit on this route.

    const req = context.switchToHttp().getRequest<Request>();
    const ip = (req.ip || req.socket?.remoteAddress || 'unknown').replace(
      /^::ffff:/,
      '',
    );
    const route = `${req.method}:${req.baseUrl}${req.path}`;
    const key = `${opts.prefix ?? 'global'}:${ip}:${route}`;

    const now = Date.now();
    const windowMs = opts.window * 1000;
    let bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
      if (this.buckets.size > this.MAX_BUCKETS) {
        this.evictExpired(now);
      }
    }

    bucket.count += 1;

    if (bucket.count > opts.limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000),
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private evictExpired(now: number) {
    for (const [k, b] of this.buckets) {
      if (b.resetAt <= now) this.buckets.delete(k);
    }
  }
}
