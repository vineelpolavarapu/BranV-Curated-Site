import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class ScrapeUrlDto {
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url!: string;
}

export class QuickAddDto {
  // ── Required ──────────────────────────────────────────────────────
  @IsString() @MinLength(1) @MaxLength(200) title!: string;

  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  rawUrl!: string;

  @IsString() @MinLength(1) @MaxLength(40) retailer!: string;

  @IsString() @MinLength(1) categoryId!: string;

  @Type(() => Number) @IsNumber() @Min(0) price!: number;

  // ── Brand: either an existing brandId OR a new brand name ──────────
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() @MaxLength(120) newBrandName?: string;

  // ── Optional ──────────────────────────────────────────────────────
  @IsOptional() @IsString() subcategoryId?: string;
  @IsOptional() @IsString() @MaxLength(20000) description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) mrp?: number;

  /** Single color for the variant(s) this Quick Add creates. */
  @IsOptional() @IsString() @MaxLength(40) color?: string;

  /** One variant per size will be created. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  sizes?: string[];

  @IsOptional() @IsString() @MaxLength(80) material?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  /** Already uploaded to S3 via /uploads/presign. */
  @IsOptional() @IsUrl({ require_tld: false }) avatarImageUrl?: string;

  /** Scraped from retailer page; optional. */
  @IsOptional() @IsUrl({ require_tld: false }) retailerImageUrl?: string;

  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
}
