import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { SKIP_TWO_FACTOR_KEY } from '../decorators/skip-2fa.decorator';

/**
 * Enforces PRD §18.2: ADMINs must have TOTP 2FA enabled to perform any action.
 * Use globally — routes that must be reachable before 2FA setup (the setup
 * endpoints themselves, /auth/me) opt out with @Skip2FA().
 */
@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_TWO_FACTOR_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthenticatedUser | undefined;
    if (!user) return true; // JwtAuthGuard or @Public handles unauth

    if (user.role === UserRole.ADMIN && !user.totpEnabled) {
      throw new ForbiddenException('Admin must enable 2FA before this action');
    }
    return true;
  }
}
