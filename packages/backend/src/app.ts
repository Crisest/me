import express, { Application, Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { apiLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';
import transactionsRoutes from './modules/transactions';
import loginRoutes from './modules/auth';
import bankRoutes from './modules/banks/bank.routes';
import cardRoutes from './modules/cards/card.routes';
import budgetRoutes from './modules/budget';
import uploadRoutes from './modules/uploads';
import householdRoutes from './modules/households';
import accountRoutes from './modules/accounts';
import plaidRoutes from './modules/plaid';
import devRoutes from './modules/dev';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { getConfig } from './config/env';
import { errorHandler } from './middleware/errorHandler';
dotenv.config();

const app: Application = express();
const config = getConfig();

// Nginx Proxy Manager fronts this app and reaches it over the LAN rather than
// loopback, so without this every request arrives wearing the proxy's address:
// req.ip is the proxy for all traffic, and the rate limiter buckets the whole
// household — every device, every user — together.
//
// Scoped to the proxy's specific address (TRUST_PROXY) rather than `true`
// because :3000 is also reachable directly on the LAN; see config/env.ts.
if (config.trustProxy) {
  app.set(
    'trust proxy',
    config.trustProxy.split(',').map(entry => entry.trim())
  );
}

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy:
      config.nodeEnv === 'production'
        ? {
            useDefaults: false,
            directives: {
              defaultSrc: ["'self'", 'https://cdn.plaid.com/'],
              scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://cdn.plaid.com/link/v2/stable/link-initialize.js',
              ],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: [
                "'self'",
                'data:',
                'blob:',
                'https://plaid-merchant-logos.plaid.com',
                'https://plaid-category-icons.plaid.com',
              ],
              connectSrc: ["'self'", `https://${config.plaid.env}.plaid.com/`],
              fontSrc: ["'self'", 'data:'],
              frameSrc: ['https://cdn.plaid.com/'],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'self'"],
              objectSrc: ["'none'"],
            },
          }
        : false,
    // App is served over HTTP on the LAN via NPM; HSTS would force HTTPS and break loads
    strictTransportSecurity: false,
  })
);

// Request logging middleware
app.use(requestLogger);

// CORS configuration
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// Request parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(cookieParser());

// Rate limiting, mounted on the API surface only: the static bundle, its fonts
// and favicon.ico are dozens of requests per cold load and have no business
// spending the same budget as the API.
app.use(
  [
    '/transactions',
    '/auth',
    '/banks',
    '/cards',
    '/budget',
    '/uploads',
    '/households',
    '/accounts',
    '/plaid',
  ],
  apiLimiter
);

// Routes
app.use('/transactions', transactionsRoutes);
app.use('/auth', loginRoutes);
app.use('/banks', bankRoutes);
app.use('/cards', cardRoutes);
app.use('/budget', budgetRoutes);
app.use('/uploads', uploadRoutes);
app.use('/households', householdRoutes);
app.use('/accounts', accountRoutes);
app.use('/plaid', plaidRoutes);
if (config.nodeEnv !== 'production') {
  app.use('/dev', devRoutes);
}

// In production, serve the Vite-built frontend
if (config.nodeEnv === 'production') {
  const staticPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(staticPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

export default app;
