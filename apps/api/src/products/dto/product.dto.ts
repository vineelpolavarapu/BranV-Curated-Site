import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AvailabilityStatus, ProductStatus } from '@prisma/client';

export class VariantInput {
  @IsOptional() @IsString() @MaxLength(80) sku?: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(40) color?: string;
  @IsOptional() @IsString() @MaxLength(40) size?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class ImageInput {
  @IsUrl({ require_tld: false }) url!: string;
  @IsOptional() @IsString() @MaxLength(255) altText?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() isAiGenerated?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class RetailerListingInput {
  @IsString() @MinLength(1) @MaxLength(40) retailer!: string;
  @IsUrl({ require_tld: false }) retailerProductUrl!: string;
  @IsOptional() @IsUrl({ require_tld: false }) retailerImageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rawPrice?: number;

  @IsOptional() @IsEnum(AvailabilityStatus) availabilityStatus?: AvailabilityStatus;
}

export class CreateProductDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @IsString() @MinLength(1) brandId!: string;
  @IsString() @MinLength(1) categoryId!: string;
  @IsOptional() @IsString() subcategoryId?: string;
  @IsOptional() @IsString() @MaxLength(20000) description?: string;

  @Type(() => Number) @IsNumber() @Min(0) price!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) mrp?: number;

  @IsOptional() @IsString() @MaxLength(40) primaryRetailer?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() @MaxLength(200) metaTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) metaDescription?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => VariantInput)
  variants?: VariantInput[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ImageInput)
  images?: ImageInput[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RetailerListingInput)
  retailerListings?: RetailerListingInput[];
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() subcategoryId?: string | null;
  @IsOptional() @IsString() @MaxLength(20000) description?: string | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) mrp?: number | null;
  @IsOptional() @IsString() @MaxLength(40) primaryRetailer?: string | null;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() @MaxLength(200) metaTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(500) metaDescription?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];
}

export class ProductListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
}
