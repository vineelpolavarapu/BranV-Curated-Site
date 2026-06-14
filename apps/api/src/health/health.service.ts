import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../prisma/prisma.service';

type CheckResult = { ok: boolean; latencyMs?: number; error?: string };

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'branv-dev';
    this.s3 = new S3Client({
      endpoint: this.config.get<string>('S3_ENDPOINT'),
      region: this.config.get<string>('S3_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY') ?? '',
        secretAccessKey: this.config.get<string>('S3_SECRET_KEY') ?? '',
      },
      forcePathStyle:
        this.config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
    });
  }

  onModuleDestroy() {
    this.s3.destroy();
  }

  async checkAll(): Promise<Record<string, CheckResult>> {
    const [db, storage] = await Promise.all([this.checkDb(), this.checkS3()]);
    return { db, storage };
  }

  private async checkDb(): Promise<CheckResult> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  private async checkS3(): Promise<CheckResult> {
    const started = Date.now();
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
