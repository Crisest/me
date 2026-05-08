import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { getConfig } from '@/config/env';

let cached: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (cached) return cached;

  const { clientId, secret, env } = getConfig().plaid;
  const basePath = PlaidEnvironments[env];
  if (!basePath) {
    throw new Error(`Unknown PLAID_ENV: ${env}`);
  }

  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });

  cached = new PlaidApi(configuration);
  return cached;
}
