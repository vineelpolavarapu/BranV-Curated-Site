import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReviewStatus } from '@prisma/client';

export class CreateReviewDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(140) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) body?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsUrl({ require_tld: false }, { each: true })
  imageUrls?: string[];
}

export class ReviewsListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number = 12;
}

export class ModerateReviewDto {
  @IsEnum(ReviewStatus) status!: ReviewStatus;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class AdminReviewsListQueryDto extends ReviewsListQueryDto {
  @IsOptional() @IsEnum(ReviewStatus) status?: ReviewStatus;
}
