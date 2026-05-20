import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';
import { PresignUploadDto, UploadKind } from './dto/upload.dto';

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

@Injectable()
export class UploadsService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly expiresIn = 60 * 10; // 10 minutes

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET') ?? 'branv-dev';
    const endpoint = config.get<string>('S3_ENDPOINT');
    this.publicBaseUrl = `${endpoint?.replace(/\/$/, '')}/${this.bucket}`;

    this.s3 = new S3Client({
      endpoint,
      region: config.get<string>('S3_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: config.get<string>('S3_ACCESS_KEY') ?? '',
        secretAccessKey: config.get<string>('S3_SECRET_KEY') ?? '',
      },
      forcePathStyle:
        config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
    });
  }

  async presign(dto: PresignUploadDto): Promise<PresignResult> {
    const key = this.buildKey(dto);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: this.expiresIn,
    });
    return {
      uploadUrl,
      publicUrl: `${this.publicBaseUrl}/${key}`,
      key,
      expiresIn: this.expiresIn,
    };
  }

  private buildKey(dto: PresignUploadDto): string {
    const ext = dto.filename.split('.').pop()?.toLowerCase() ?? 'bin';
    const id = nanoid(16);
    const ownerSegment = dto.ownerId ? `${dto.ownerId}/` : '';
    return `${this.folderFor(dto.kind)}/${ownerSegment}${id}.${ext}`;
  }

  private folderFor(kind: UploadKind): string {
    switch (kind) {
      case UploadKind.BRAND_LOGO: return 'brands/logos';
      case UploadKind.BRAND_HERO: return 'brands/heroes';
      case UploadKind.PRODUCT_IMAGE: return 'products/retailer';
      case UploadKind.PRODUCT_AVATAR: return 'products/avatars';
      case UploadKind.AVATAR_REFERENCE: return 'avatars/references';
      case UploadKind.ARTICLE_HERO: return 'articles/heroes';
      case UploadKind.LOOKBOOK_IMAGE: return 'lookbooks';
      case UploadKind.BANNER: return 'banners';
    }
  }
}
