import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class ConvertUrlDto {
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  rawUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  retailer?: string;
}
