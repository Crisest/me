import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  cookieSecure: (process.env.FRONTEND_URL || '').startsWith('https://'),
  apiUrl: process.env.VITE_API_URL || 'http://localhost:3000',
  sslCertPath: process.env.SSL_CERT_PATH || '',
  sslKeyPath: process.env.SSL_KEY_PATH || '',
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  plaid: {
    clientId: process.env.PLAID_CLIENT_ID || '',
    secret: process.env.PLAID_SECRET || '',
    env: (process.env.PLAID_ENV || 'sandbox') as 'sandbox' | 'development' | 'production',
    tokenEncryptionKey: process.env.PLAID_TOKEN_ENCRYPTION_KEY || '',
  },
};

if (config.nodeEnv === 'production') {
  const missing = (['clientId', 'secret', 'tokenEncryptionKey'] as const).filter(
    k => !config.plaid[k]
  );
  if (missing.length > 0) {
    throw new Error(`Missing required Plaid env vars: ${missing.map(k => k.toUpperCase()).join(', ')}`);
  }
}

export const getConfig = () => config;
