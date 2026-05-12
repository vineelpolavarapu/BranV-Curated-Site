import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  totp: boolean;
  ev: boolean; // emailVerified
}

export const ACCESS_COOKIE = 'branv_access';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing access token');

    try {
      const secret = this.config.get<string>('JWT_ACCESS_SECRET')!;
      const payload = jwt.verify(token, secret) as AccessTokenPayload;
      (req as Request & { user: unknown }).user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        totpEnabled: payload.totp,
        emailVerified: payload.ev,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractToken(req: Request): string | undefined {
    const fromCookie = (req.cookies?.[ACCESS_COOKIE] as string) ?? undefined;
    if (fromCookie) return fromCookie;
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return undefined;
  }
}
