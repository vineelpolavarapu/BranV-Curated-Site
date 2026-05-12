import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export enum UploadKind {
  BRAND_LOGO = 'brand-logo',
  BRAND_HERO = 'brand-hero',
  PRODUCT_IMAGE = 'product-image',
  PRODUCT_AVATAR = 'product-avatar', // AI-rendered, per PRD §8
  AVATAR_REFERENCE = 'avatar-reference',
  ARTICLE_HERO = 'article-hero',
  DROP_HERO = 'drop-hero',
  LOOKBOOK_IMAGE = 'lookbook-image',
  BANNER = 'banner',
}

const ALLOWED_CONTENT_TYPES = /^image\/(png|jpeg|jpg|webp|avif|gif)$/;

export class PresignUploadDto {
  @IsString()
  @Matches(ALLOWED_CONTENT_TYPES, {
    message: 'contentType must be a supported image MIME type',
  })
  contentType!: string;

  @IsString()
  @MaxLength(120)
  @Matches(/^[\w.\- ]+$/, { message: 'filename has unsupported characters' })
  filename!: string;

  @IsEnum(UploadKind)
  kind!: UploadKind;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ownerId?: string;
}
