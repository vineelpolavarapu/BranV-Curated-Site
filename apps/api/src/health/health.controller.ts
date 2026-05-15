import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller()
@Public()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  @HttpCode(200)
  liveness() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? 'dev',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async readiness(@Res() res: Response) {
    const checks = await this.health.checkAll();
    const ok = Object.values(checks).every((c) => c.ok);
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  }
}
