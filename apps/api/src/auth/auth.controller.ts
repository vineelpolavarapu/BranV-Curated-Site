import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { AuthService, RequestContext } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TwoFactorDisableDto,
  TwoFactorVerifyDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { Skip2FA } from '../common/decorators/skip-2fa.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import {
  ACCESS_COOKIE,
  JwtAuthGuard,
} from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RateLimit, RateLimitGuard } from '../common/guards/rate-limit.guard';

const REFRESH_COOKIE = 'branv_refresh';

interface CookieOpts {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  domain?: string;
  maxAge?: number;
}

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {
    this.accessTtlMs =
      Number(config.get('JWT_ACCESS_TTL_SECONDS') ?? 900) * 1000;
    this.refreshTtlMs =
      Number(config.get('JWT_REFRESH_TTL_SECONDS') ?? 604800) * 1000;
  }

  // ──────────────────────────── REGISTER ────────────────────────────

  @Public()
  @Post('register')
  @RateLimit({ limit: 5, window: 60, prefix: 'auth-register' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    await this.auth.register(
      dto.email,
      dto.password,
      { firstName: dto.firstName, lastName: dto.lastName },
      this.ctx(req),
    );
    return {
      status: 'ok',
      message: 'Account created. Check your email to verify.',
    };
  }

  // ──────────────────────────── LOGIN (member) ────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 5, window: 60, prefix: 'auth-login' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(
      dto.email,
      dto.password,
      dto.totpCode,
      UserRole.MEMBER,
      this.ctx(req),
    );
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return this.publicUser(result.user);
  }

  // ──────────────────────────── LOGIN (admin) ────────────────────────────

  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 5, window: 60, prefix: 'auth-admin-login' })
  async adminLogin(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(
      dto.email,
      dto.password,
      dto.totpCode,
      UserRole.ADMIN,
      this.ctx(req),
    );
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return this.publicUser(result.user);
  }

  // ──────────────────────────── REFRESH ────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!presented) {
      return res.status(401).json({ message: 'No refresh token' });
    }
    const result = await this.auth.refresh(presented, this.ctx(req));
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return this.publicUser(result.user);
  }

  // ──────────────────────────── LOGOUT ────────────────────────────

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const userId = (req as Request & { user?: AuthenticatedUser }).user?.id;
    await this.auth.logout(presented, userId);
    this.clearAuthCookies(res);
    return { status: 'ok' };
  }

  // ──────────────────────────── EMAIL VERIFICATION ────────────────────────────

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    await this.auth.verifyEmail(dto.token, this.ctx(req));
    return { status: 'ok' };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 3, window: 60, prefix: 'auth-resend' })
  async resendVerification(@Body() dto: ForgotPasswordDto) {
    await this.auth.resendVerification(dto.email);
    return { status: 'ok' };
  }

  // ──────────────────────────── PASSWORD RESET ────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 3, window: 60, prefix: 'auth-forgot' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ) {
    await this.auth.forgotPassword(dto.email, this.ctx(req));
    return { status: 'ok' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ) {
    await this.auth.resetPassword(dto.token, dto.newPassword, this.ctx(req));
    return { status: 'ok' };
  }

  // ──────────────────────────── 2FA ────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Skip2FA()
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  async setup2fa(@CurrentUser() user: AuthenticatedUser) {
    const setup = await this.auth.beginTwoFactorSetup(user.id);
    // Don't leak the raw secret in production responses — the QR is enough.
    return {
      otpauthUrl: setup.otpauthUrl,
      qrCodeDataUrl: setup.qrCodeDataUrl,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Skip2FA()
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verify2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorVerifyDto,
    @Req() req: Request,
  ) {
    await this.auth.confirmTwoFactorSetup(user.id, dto.code, this.ctx(req));
    return { status: 'ok' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  async disable2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorDisableDto,
    @Req() req: Request,
  ) {
    await this.auth.disableTwoFactor(
      user.id,
      dto.password,
      dto.code,
      this.ctx(req),
    );
    return { status: 'ok' };
  }

  // ──────────────────────────── ME ────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Skip2FA() // /me must be reachable even before admin has set up 2FA
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  // ──────────────────────────── helpers ────────────────────────────

  private ctx(req: Request): RequestContext {
    return {
      ip: (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, ''),
      userAgent: req.headers['user-agent'],
    };
  }

  private cookieOpts(maxAgeMs: number): CookieOpts {
    const secure =
      (this.config.get<string>('COOKIE_SECURE') ?? 'false') === 'true';
    const sameSiteRaw =
      (this.config.get<string>('COOKIE_SAMESITE') ?? 'lax').toLowerCase();
    const sameSite: 'lax' | 'strict' | 'none' =
      sameSiteRaw === 'strict' || sameSiteRaw === 'none' ? sameSiteRaw : 'lax';
    const domain = this.config.get<string>('COOKIE_DOMAIN') || undefined;
    return {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      domain,
      maxAge: maxAgeMs,
    };
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    res.cookie(ACCESS_COOKIE, accessToken, this.cookieOpts(this.accessTtlMs));
    res.cookie(
      REFRESH_COOKIE,
      refreshToken,
      this.cookieOpts(this.refreshTtlMs),
    );
  }

  private clearAuthCookies(res: Response) {
    const opts = { ...this.cookieOpts(0), maxAge: undefined };
    res.clearCookie(ACCESS_COOKIE, opts);
    res.clearCookie(REFRESH_COOKIE, opts);
  }

  private publicUser(user: {
    id: string;
    email: string;
    role: UserRole;
    totpEnabled: boolean;
    emailVerifiedAt: Date | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      totpEnabled: user.totpEnabled,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }
}
