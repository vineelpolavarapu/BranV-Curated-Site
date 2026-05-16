/**
 * Reads the access cookie and returns the userId — without throwing if
 * absent or invalid. Use this in controllers that are marked `@Public()`
 * but want to behave differently for signed-in users (e.g. /me-style
 * queries that should return an empty / anonymous shape for visitors
 * instead of a 401).
 *
 * Distinct from JwtAuthGuard, which throws UnauthorizedException — that's
 * still the right choice for endpoints where being unauthenticated is an
 * actual error.
 */
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import {
  ACCESS_COOKIE,
  AccessTokenPayload,
} from '../guards/jwt-auth.guard';

export function tryReadUserId(
  req: Request,
  config: ConfigService,
): string | null {
  const token = (req.cookies?.[ACCESS_COOKIE] as string) ?? undefined;
  if (!token) return null;
  try {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) return null;
    const payload = jwt.verify(token, secret) as AccessTokenPayload;
    return payload.sub;
  } catch {
    return null;
  }
}
