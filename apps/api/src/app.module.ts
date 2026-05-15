import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { MailModule } from './mail/mail.module';
import { BrandsModule } from './brands/brands.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { AvatarsModule } from './avatars/avatars.module';
import { UploadsModule } from './uploads/uploads.module';
import { ScrapeModule } from './scrape/scrape.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { StorefrontModule } from './storefront/storefront.module';
import { ClicksModule } from './clicks/clicks.module';
import { WardrobeModule } from './wardrobe/wardrobe.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ArticlesModule } from './articles/articles.module';
import { DropsModule } from './drops/drops.module';
import { LookbooksModule } from './lookbooks/lookbooks.module';
import { EditsModule } from './edits/edits.module';
import { BannersModule } from './banners/banners.module';
import { BrandStoriesModule } from './brand-stories/brand-stories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { PriceSyncModule } from './price-sync/price-sync.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SettingsModule } from './settings/settings.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TwoFactorGuard } from './common/guards/two-factor.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        genReqId: (req) =>
          (req.headers['x-request-id'] as string) ?? randomUUID(),
        customProps: (req) => ({ requestId: req.id }),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, colorize: true },
              },
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          censor: '[redacted]',
        },
      },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    AuditModule,
    MailModule,
    HealthModule,
    AuthModule,
    BrandsModule,
    CategoriesModule,
    ScrapeModule,
    AffiliateModule,
    ProductsModule,
    AvatarsModule,
    UploadsModule,
    StorefrontModule,
    ClicksModule,
    WardrobeModule,
    WishlistModule,
    ArticlesModule,
    DropsModule,
    LookbooksModule,
    EditsModule,
    BannersModule,
    BrandStoriesModule,
    NotificationsModule,
    ReviewsModule,
    NewsletterModule,
    PriceSyncModule,
    ReconciliationModule,
    AnalyticsModule,
    SettingsModule,
  ],
  providers: [
    // Global JWT auth — opt out per-route with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global 2FA enforcement for admins — opt out per-route with @Skip2FA().
    { provide: APP_GUARD, useClass: TwoFactorGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
