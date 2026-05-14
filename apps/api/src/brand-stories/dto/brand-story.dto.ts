import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { BrandStoryStatus } from '@prisma/client';

export class UpsertBrandStoryDto {
  @IsOptional() @IsUrl({ require_tld: false }) heroUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(50000) bodyMd?: string;
  @IsOptional() @IsEnum(BrandStoryStatus) status?: BrandStoryStatus;
}
