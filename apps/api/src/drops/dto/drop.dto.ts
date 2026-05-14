import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
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
import { DropStatus } from '@prisma/client';

export class CreateDropDto {
  @IsString() @MinLength(1) @MaxLength(140) name!: string;
  @IsOptional() @IsString() @MaxLength(140) slug?: string;
  @IsOptional() @IsUrl({ require_tld: false }) heroUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsDateString() launchAt!: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsEnum(DropStatus) status?: DropStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @IsString({ each: true })
  productIds?: string[];
}

export class UpdateDropDto {
  @IsOptional() @IsString() @MaxLength(140) name?: string;
  @IsOptional() @IsString() @MaxLength(140) slug?: string;
  @IsOptional() @IsUrl({ require_tld: false }) heroUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsDateString() launchAt?: string;
  @IsOptional() @IsDateString() endsAt?: string | null;
  @IsOptional() @IsEnum(DropStatus) status?: DropStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @IsString({ each: true })
  productIds?: string[];
}

export class DropListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) pageSize?: number = 24;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(DropStatus) status?: DropStatus;
}

export class NotifyMeDto {
  @IsEmail() @MaxLength(254) email!: string;
}
