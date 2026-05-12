import { AffiliatePartner } from '@prisma/client';

export interface AffiliateConversionResult {
  partner: AffiliatePartner;
  convertedUrl: string;
  partnerLinkId: string | null;
  pendingConversion: boolean;
  source: 'cuelinks' | 'cuelinks-mock' | 'amazon-direct' | 'earnkaro' | 'fallback';
  error?: string;
}
