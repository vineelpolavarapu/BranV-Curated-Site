import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

export interface TwoFactorSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

@Injectable()
export class TwoFactorService {
  private readonly issuer: string;

  constructor(config: ConfigService) {
    this.issuer = config.get<string>('TOTP_ISSUER') ?? 'BranV';
    // Allow ±1 window (30s either side) to forgive small clock drift.
    authenticator.options = { window: 1 };
  }

  async generateSetup(accountEmail: string): Promise<TwoFactorSetupResult> {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(accountEmail, this.issuer, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  verify(code: string, secret: string): boolean {
    try {
      return authenticator.verify({ token: code, secret });
    } catch {
      return false;
    }
  }
}
