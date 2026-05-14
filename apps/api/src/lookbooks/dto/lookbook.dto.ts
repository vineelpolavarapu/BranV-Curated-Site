import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LookbookStatus } from '@prisma/client';

export class LookbookTagInput {
  @IsString() productId!: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) xPercent!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) yPercent!: number;
}

export class LookbookImageInput {
  @IsUrl({ require_tld: false }) imageUrl!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) position?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => LookbookTagInput)
  tags?: LookbookTagInput[];
}

export class CreateLookbookDto {
  @IsString() @MinLength(1) @MaxLength(140) title!: string;
  @IsOptional() @IsString() @MaxLength(140) slug?: string;
  @IsOptional() @IsUrl({ require_tld: false }) heroUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsEnum(LookbookStatus) status?: LookbookStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => LookbookImageInput)
  images?: LookbookImageInput[];
}

export class UpdateLookbookDto extends CreateLookbookDto {}

export class LookbookListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) pageSize?: number = 24;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(LookbookStatus) status?: LookbookStatus;
}
