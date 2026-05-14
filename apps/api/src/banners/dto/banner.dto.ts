import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { HomeBannerStatus } from '@prisma/client';

export class CreateBannerDto {
  @IsUrl({ require_tld: false }) @MinLength(1) imageUrl!: string;
  @IsOptional() @IsString() @MaxLength(140) headline?: string;
  @IsOptional() @IsString() @MaxLength(40) ctaLabel?: string;
  @IsOptional() @IsString() @MaxLength(500) ctaLink?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() endsAt?: string | null;
  @IsOptional() @IsEnum(HomeBannerStatus) status?: HomeBannerStatus;
}

export class UpdateBannerDto extends CreateBannerDto {}
