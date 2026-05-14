import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { Public } from '../common/decorators/public.decorator';
import {
  ACCESS_COOKIE,
  AccessTokenPayload,
} from '../common/guards/jwt-auth.guard';
import { DropsService } from './drops.service';
import { NotifyMeDto } from './dto/drop.dto';

@Controller('drops')
export class DropsPublicController {
  constructor(
    private readonly drops: DropsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  list() {
    return this.drops.listPublic();
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.drops.getPublicBySlug(slug);
  }

  @Public()
  @Post(':slug/notify-me')
  @HttpCode(200)
  async notify(
    @Param('slug') slug: string,
    @Body() dto: NotifyMeDto,
    @Req() req: Request,
  ) {
    await this.drops.addNotifySignup(slug, dto.email, this.tryGetUserId(req));
    return { status: 'ok' };
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
