import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { NotificationChannel, NotificationType } from '@prisma/client';

export class NotificationsListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number = 20;
  @IsOptional() @Type(() => Boolean) @IsBoolean() unreadOnly?: boolean;
}

export class UpdatePreferenceDto {
  @IsEnum(NotificationType) type!: NotificationType;
  @IsEnum(NotificationChannel) channel!: NotificationChannel;
  @IsBoolean() enabled!: boolean;
}
