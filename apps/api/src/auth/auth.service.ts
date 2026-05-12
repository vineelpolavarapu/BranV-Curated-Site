import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, UserRole, UserStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export interface LoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly maxAttempts: number;
  private readonly lockoutMinutes: number;
  private readonly attemptWindowMinutes: number;
  private readonly webOrigin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly twoFactor: TwoFactorService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.maxAttempts = Number(config.get('AUTH_LOCKOUT_MAX_ATTEMPTS') ?? 5);
    this.lockoutMinutes = Number(
      config.get('AUTH_LOCKOUT_DURATION_MIN') ?? 15,
    );
    this.attemptWindowMinutes = Number(
      config.get('AUTH_LOCKOUT_WINDOW_MIN') ?? 15,
    );
    this.webOrigin =
      config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  }

  // ──────────────────────────── REGISTER ────────────────────────────

  async register(
    email: string,
    password: string,
    profile: { firstName?: string; lastName?: string },
    ctx: RequestContext,
  ): Promise<{ userId: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      // Don't leak existence — return a generic 400.
      throw new BadRequestException(
        'If this email is available, you will receive a verification message',
      );
    }

    const passwordHash = await this.passwords.hash(password);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: UserRole.MEMBER,
        profile: {
          create: {
            firstName: profile.firstName,
            lastName: profile.lastName,
          },
        },
      },
    });

    await this.issueAndSendVerification(user);
    await this.audit.record({
      actorId: user.id,
      action: 'auth.register',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { userId: user.id };
  }

  // ──────────────────────────── LOGIN ────────────────────────────

  async login(
    email: string,
    password: string,
    totpCode: string | undefined,
    expectedRole: UserRole | null,
    ctx: RequestContext,
  ): Promise<LoginResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Constant-ish response — same error for missing/bad creds.
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.audit.record({
        action: 'auth.login.fail',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { email: normalizedEmail, reason: 'unknown_user' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.record({
        actorId: user.id,
        action: 'auth.login.locked',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException(
        'Account temporarily locked. Try again later.',
      );
    }

    const passwordOk = await this.passwords.verify(
      user.passwordHash,
      password,
    );
    if (!passwordOk) {
      await this.recordFailedAttempt(user, ctx);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (expectedRole && user.role !== expectedRole) {
      // E.g. member trying admin login or vice versa.
      await this.audit.record({
        actorId: user.id,
        action: 'auth.login.wrong_portal',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new ForbiddenException('Wrong sign-in portal for this account');
    }

    // 2FA enforcement.
    if (user.totpEnabled) {
      if (!totpCode) {
        throw new UnauthorizedException({
          message: '2FA code required',
          requires2fa: true,
        });
      }
      const ok = this.twoFactor.verify(totpCode, user.totpSecret!);
      if (!ok) {
        await this.recordFailedAttempt(user, ctx);
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    // Success — reset counters, stamp last login.
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const accessToken = this.tokens.signAccessToken(updated);
    const refreshToken = await this.tokens.issueRefreshToken(
      updated.id,
      ctx.ip,
      ctx.userAgent,
    );

    await this.audit.record({
      actorId: user.id,
      action: 'auth.login.success',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { user: updated, accessToken, refreshToken };
  }

  private async recordFailedAttempt(user: User, ctx: RequestContext) {
    const now = new Date();
    const windowStart = new Date(
      now.getTime() - this.attemptWindowMinutes * 60 * 1000,
    );
    // Reset the counter if either (a) the previous failure run aged out of the
    // window, or (b) a prior lockout has now expired (start them fresh).
    const lockoutJustExpired = !!user.lockedUntil && user.lockedUntil < now;
    const counterStale = user.updatedAt < windowStart;
    const shouldReset = lockoutJustExpired || counterStale;

    const nextCount = shouldReset ? 1 : user.failedLoginCount + 1;
    const shouldLock = nextCount >= this.maxAttempts;
    const lockedUntil = shouldLock
      ? new Date(now.getTime() + this.lockoutMinutes * 60 * 1000)
      : lockoutJustExpired
        ? null
        : user.lockedUntil;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: nextCount, lockedUntil },
    });

    await this.audit.record({
      actorId: user.id,
      action: shouldLock ? 'auth.login.lockout' : 'auth.login.fail',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { failedCount: nextCount },
    });
  }

  // ──────────────────────────── REFRESH / LOGOUT ────────────────────────────

  refresh(token: string, ctx: RequestContext) {
    return this.tokens.rotate(token, ctx.ip, ctx.userAgent);
  }

  async logout(refreshToken: string | undefined, userId: string | undefined) {
    if (refreshToken) await this.tokens.revokeRefreshToken(refreshToken);
    if (userId) {
      await this.audit.record({ actorId: userId, action: 'auth.logout' });
    }
  }

  // ──────────────────────────── EMAIL VERIFICATION ────────────────────────────

  private async issueAndSendVerification(user: User): Promise<void> {
    const raw = nanoid(48);
    const tokenHash = sha256(raw);
    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
    });
    const link = `${this.webOrigin}/verify-email?token=${raw}`;
    await this.mail.sendEmailVerification(user.email, link);
  }

  async verifyEmail(token: string, ctx: RequestContext): Promise<void> {
    const tokenHash = sha256(token);
    const record = await this.prisma.emailVerification.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
    await this.audit.record({
      actorId: record.userId,
      action: 'auth.email.verified',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (user && !user.emailVerifiedAt) {
      await this.issueAndSendVerification(user);
    }
    // Always succeed silently to avoid email-enumeration.
  }

  // ──────────────────────────── PASSWORD RESET ────────────────────────────

  async forgotPassword(email: string, ctx: RequestContext): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (user) {
      const raw = nanoid(48);
      const tokenHash = sha256(raw);
      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });
      const link = `${this.webOrigin}/reset-password?token=${raw}`;
      await this.mail.sendPasswordReset(user.email, link);
      await this.audit.record({
        actorId: user.id,
        action: 'auth.password.reset_requested',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }
    // Always succeed silently.
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ctx: RequestContext,
  ): Promise<void> {
    const tokenHash = sha256(token);
    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      }),
      // Invalidate all sessions on password reset.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.record({
      actorId: record.userId,
      action: 'auth.password.reset',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  // ──────────────────────────── 2FA ────────────────────────────

  async beginTwoFactorSetup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const setup = await this.twoFactor.generateSetup(user.email);
    // Stash secret unconfirmed; only flip totpEnabled once verified.
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: setup.secret, totpEnabled: false },
    });
    return setup;
  }

  async confirmTwoFactorSetup(
    userId: string,
    code: string,
    ctx: RequestContext,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.totpSecret) {
      throw new BadRequestException('No 2FA setup in progress');
    }
    const ok = this.twoFactor.verify(code, user.totpSecret);
    if (!ok) throw new BadRequestException('Invalid 2FA code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });
    await this.audit.record({
      actorId: userId,
      action: 'auth.2fa.enabled',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  async disableTwoFactor(
    userId: string,
    password: string,
    code: string,
    ctx: RequestContext,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Admins cannot disable 2FA');
    }
    const passwordOk = await this.passwords.verify(
      user.passwordHash,
      password,
    );
    if (!passwordOk) throw new UnauthorizedException('Invalid password');
    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('2FA is not enabled');
    }
    const codeOk = this.twoFactor.verify(code, user.totpSecret);
    if (!codeOk) throw new BadRequestException('Invalid 2FA code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });
    await this.audit.record({
      actorId: userId,
      action: 'auth.2fa.disabled',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  // ──────────────────────────── ME ────────────────────────────

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerifiedAt !== null,
      totpEnabled: user.totpEnabled,
      profile: user.profile,
      createdAt: user.createdAt,
    };
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
