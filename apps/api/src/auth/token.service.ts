import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenPayload } from '../common/guards/jwt-auth.guard';

@Injectable()
export class TokenService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Access tokens (self-validating JWTs, no DB lookup on hot path) ──
  signAccessToken(user: User): string {
    const secret = this.config.get<string>('JWT_ACCESS_SECRET')!;
    const ttl = Number(this.config.get('JWT_ACCESS_TTL_SECONDS') ?? 900);
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      totp: user.totpEnabled,
      ev: user.emailVerifiedAt !== null,
    };
    return jwt.sign(payload, secret, { expiresIn: ttl });
  }

  // ── Refresh tokens (opaque random strings, sha256-hashed in DB) ──
  async issueRefreshToken(
    userId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    const tokenHash = sha256(raw);
    const ttl = Number(
      this.config.get('JWT_REFRESH_TTL_SECONDS') ?? 60 * 60 * 24 * 7,
    );
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + ttl * 1000),
        ip,
        userAgent,
      },
    });
    return raw;
  }

  /**
   * Validate a presented refresh token, rotate it, and return the new pair.
   * Detects reuse: if a revoked token is replayed, the entire token family
   * for that user is revoked (forces re-login).
   */
  async rotate(
    presentedToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    const tokenHash = sha256(presentedToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) throw new UnauthorizedException('Invalid refresh token');

    if (record.revokedAt) {
      // Reuse detection — revoke the entire family.
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const newRefresh = await this.issueRefreshToken(
      record.userId,
      ip,
      userAgent,
    );
    const newHash = sha256(newRefresh);
    const newRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: newHash },
    });

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedById: newRecord?.id },
    });

    const accessToken = this.signAccessToken(record.user);
    return { accessToken, refreshToken: newRefresh, user: record.user };
  }

  async revokeRefreshToken(presentedToken: string): Promise<void> {
    const tokenHash = sha256(presentedToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
