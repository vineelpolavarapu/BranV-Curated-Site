import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditAdminController } from './audit.controller';

@Global()
@Module({
  controllers: [AuditAdminController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
