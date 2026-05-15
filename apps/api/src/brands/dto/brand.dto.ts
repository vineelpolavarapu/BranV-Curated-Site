import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BrandStatus } from '@prisma/client';

export class CreateBrandDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @IsOptional() @IsUrl({ require_tld: false }) logoUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) heroUrl?: string;

  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsBoolean() isFeatured?: boolean;

  @IsOptional() @IsEnum(BrandStatus) status?: BrandStatus;
}

export class UpdateBrandDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @IsOptional() @IsUrl({ require_tld: false }) logoUrl?: string | null;
  @IsOptional() @IsUrl({ require_tld: false }) heroUrl?: string | null;

  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsEnum(BrandStatus) status?: BrandStatus;
}
