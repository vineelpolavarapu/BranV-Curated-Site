import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ClickReportOutcome } from '@prisma/client';

export class TrackClickDto {
  @IsString()
  @Length(1, 64)
  productId!: string;

  @IsString()
  @Length(1, 64)
  retailer!: string;

  @IsOptional()
  @IsString()
  @Length(1, 1024)
  sourcePageUrl?: string;
}

export class ReportClickDto {
  @IsEnum(ClickReportOutcome)
  outcome!: ClickReportOutcome;
}
