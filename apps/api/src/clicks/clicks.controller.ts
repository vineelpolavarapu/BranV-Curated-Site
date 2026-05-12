import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { Public } from '../common/decorators/public.decorator';
import {
  ACCESS_COOKIE,
  AccessTokenPayload,
} from '../common/guards/jwt-auth.guard';
import { ClicksService } from './clicks.service';
import { ReportClickDto, TrackClickDto } from './dto/clicks.dto';

@Controller()
export class ClicksController {
  constructor(
    private readonly clicks: ClicksService,
    private readonly config: ConfigService,
  ) {}

  /** Mint a tracking ID for a (productId, retailer) pair. */
  @Public()
  @Post('clicks/track')
  async track(@Body() dto: TrackClickDto) {
    const trackingId = await this.clicks.mintFromProduct(
      dto.productId,
      dto.retailer,
      dto.sourcePageUrl,
    );
    if (!trackingId) {
      // No in-stock listing for that (product, retailer) — fall through to a
      // 200 with null so the web can fall back to the raw URL without erroring.
      return { trackingId: null };
    }
    return { trackingId, goUrl: `/go/${trackingId}` };
  }

  /**
   * Short link: /go/:trackingId. Mounted outside the /api prefix per
   * BUILD_GUIDE §5.2.
   */
  @Public()
  @Get('go/:trackingId')
  async redirect(
    @Param('trackingId') trackingId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const utmEntries: Array<[string, string]> = Object.entries(req.query)
      .filter(([k]) => k.toLowerCase().startsWith('utm_'))
      .map(([k, v]) => [k, String(Array.isArray(v) ? v[0] : v)]);
    const target = await this.clicks.redirect(trackingId, {
      sessionId: req.cookies?.sid ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      ipCountry: (req.headers['cf-ipcountry'] as string | undefined) ?? null,
      utm: utmEntries.length ? Object.fromEntries(utmEntries) : null,
    });
    return res.redirect(302, target);
  }

  /** Record the "Yes I bought / Just browsing / Need help" outcome. */
  @Public()
  @HttpCode(204)
  @Post('clicks/:trackingId/report')
  async report(
    @Param('trackingId') trackingId: string,
    @Body() dto: ReportClickDto,
    @Req() req: Request,
  ) {
    // Optional auth: if the access cookie is present and valid, attribute the
    // report (and any auto-wardrobe insert on PURCHASED) to that user.
    await this.clicks.report(trackingId, dto.outcome, this.tryGetUserId(req));
    return;
  }

  private tryGetUserId(req: Request): string | null {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) return null;
    try {
      const secret = this.config.get<string>('JWT_ACCESS_SECRET')!;
      const payload = jwt.verify(token, secret) as AccessTokenPayload;
      return payload.sub;
    } catch {
      return null;
    }
  }
}
