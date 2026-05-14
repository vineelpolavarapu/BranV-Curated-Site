import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
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
import { ArticleStatus } from '@prisma/client';

export class CreateArticleDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(140) slug?: string;
  @IsOptional() @IsUrl({ require_tld: false }) heroUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) excerpt?: string;
  @IsOptional() @IsString() @MaxLength(50000) bodyMd?: string;
  @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;

  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsDateString() publishedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsString() @MaxLength(200) metaTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) metaDescription?: string;
  @IsOptional() @IsUrl({ require_tld: false }) ogImage?: string;
}

export class UpdateArticleDto extends CreateArticleDto {}

export class ArticleListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) pageSize?: number = 12;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() tag?: string;
  @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
}
