import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAvatarDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsUrl({ require_tld: false }) referenceImageUrl!: string;
  @IsString() @MinLength(1) @MaxLength(4000) promptTemplate!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateAvatarDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsUrl({ require_tld: false }) referenceImageUrl?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) promptTemplate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];
}
