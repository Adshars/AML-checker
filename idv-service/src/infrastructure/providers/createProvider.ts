import logger from '../../shared/logger/index.js';
import type { AppConfig } from '../../shared/config/index.js';
import type { IIdentityProvider } from '../../domain/providers/IIdentityProvider.js';
import { FakeIdentityProvider } from './FakeIdentityProvider.js';
import { IdswyftProvider } from './IdswyftProvider.js';

/**
 * Identity provider selected by IDV_PROVIDER (fails fast without an idswyft API key)
 */
export const createProvider = (config: AppConfig): IIdentityProvider => {
  if (config.provider === 'fake') {
    logger.warn('FAKE identity provider — not for real verifications');
    return new FakeIdentityProvider();
  }

  if (!config.idswyft.apiKey) {
    throw new Error('IDSWYFT_API_KEY is required when IDV_PROVIDER=idswyft (run `npm run idv:bootstrap`)');
  }
  return new IdswyftProvider({
    baseUrl: config.idswyft.url,
    apiKey: config.idswyft.apiKey,
    timeoutMs: config.idswyft.timeout
  });
};

export default createProvider;
