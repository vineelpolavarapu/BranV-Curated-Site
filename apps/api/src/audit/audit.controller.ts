import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditService } from './audit.service';

class AuditListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number = 50;
  @IsOptional() @IsString() actorId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() targetType?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

@Controller('admin/audit')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditAdminController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() q: AuditListQueryDto) {
    return this.audit.list({
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 50,
      actorId: q.actorId,
      action: q.action,
      targetType: q.targetType,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
  }
}
