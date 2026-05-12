import { SetMetadata } from '@nestjs/common';

export const SKIP_TWO_FACTOR_KEY = 'skipTwoFactor';

/**
 * Marks a route as exempt from the admin 2FA requirement.
 * Use only on routes the admin needs to hit BEFORE setting up 2FA
 * (i.e. the 2FA setup/verify endpoints themselves, and /auth/me).
 */
export const Skip2FA = () => SetMetadata(SKIP_TWO_FACTOR_KEY, true);
