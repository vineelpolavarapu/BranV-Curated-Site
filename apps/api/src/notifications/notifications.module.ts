import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsDispatcher } from './notifications.dispatcher';
import { NotificationsController } from './notifications.controller';

/**
 * Global so any feature module (drops, articles, wishlist sync, …) can
 * inject `NotificationsService` without a per-module import dance.
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsDispatcher],
  exports: [NotificationsService],
})
export class NotificationsModule {}
