import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EditStatus } from '@prisma/client';

export class CreateEditDto {
  @IsString() @MinLength(1) @MaxLength(140) title!: string;
  @IsOptional() @IsString() @MaxLength(140) slug?: string;
  @IsOptional() @IsUrl({ require_tld: false }) heroUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsEnum(EditStatus) status?: EditStatus;
  @IsOptional() @IsBoolean() isFeaturedOnHome?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @IsString({ each: true })
  productIds?: string[];
}

export class UpdateEditDto extends CreateEditDto {}

export class EditListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) pageSize?: number = 24;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(EditStatus) status?: EditStatus;
}
