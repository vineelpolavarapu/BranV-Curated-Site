import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FilterType } from '@prisma/client';

export class UpsertAttributeSchemaDto {
  @IsString() @MinLength(1) @MaxLength(60) attributeKey!: string;
  @IsString() @MinLength(1) @MaxLength(80) displayName!: string;
  @IsEnum(FilterType) filterType!: FilterType;

  @IsOptional()
  @IsObject()
  optionsJson?: Record<string, unknown> | string[] | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class BulkUpsertAttributeSchemaDto {
  @IsArray()
  @ArrayMaxSize(30)
  schemas!: UpsertAttributeSchemaDto[];
}
