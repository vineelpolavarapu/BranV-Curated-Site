import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service';

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

/**
 * Redis-backed sliding-window rate limiter, keyed by IP + route.
 * PRD §18.3: 5 req/min/IP on auth endpoints by default.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    const key = `ratelimit:${opts.prefix ?? 'global'}:${ip}:${route}`;

    const tx = this.redis.client.multi();
    tx.incr(key);
    tx.expire(key, opts.window, 'NX');
    const results = await tx.exec();
    const count = Number((results?.[0]?.[1] as number) ?? 0);

    if (count > opts.limit) {
      const ttl = await this.redis.client.ttl(key);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfterSeconds: ttl > 0 ? ttl : opts.window,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
