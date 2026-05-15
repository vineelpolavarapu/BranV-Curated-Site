import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import {
  ACCESS_COOKIE,
  AccessTokenPayload,
} from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { NewsletterService } from './newsletter.service';
import {
  ConfirmDto,
  SubscribeDto,
  UnsubscribeDto,
} from './dto/newsletter.dto';

@Controller('newsletter')
export class NewsletterController {
  constructor(
    private readonly newsletter: NewsletterService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(@Body() dto: SubscribeDto, @Req() req: Request) {
    await this.newsletter.subscribe({
      email: dto.email,
      source: dto.source,
      userId: this.tryGetUserId(req),
    });
    return { status: 'ok' };
  }

  @Public()
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(@Body() dto: ConfirmDto) {
    return this.newsletter.confirm(dto.token);
  }

  @Public()
  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    await this.newsletter.unsubscribe(dto.token);
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

@Controller('admin/newsletter')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class NewsletterAdminController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get('subscribers')
  list(
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, Number(pageStr) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeStr) || 50));
    return this.newsletter.listAdmin(page, pageSize);
  }
}
