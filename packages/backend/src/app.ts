import express, { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { requestLogger } from './middleware/requestLogger';
import { connectToDatabase } from './db/db';
import transactionsRoutes from './modules/transactions';
import loginRoutes from './modules/auth';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { getConfig } from './config/env';
dotenv.config();

const app: Application = express();

// Security middleware
app.use(helmet());

// Request logging middleware
app.use(requestLogger);

// CORS configuration
const config = getConfig();
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMsm
});
app.use(limiter);

// Routes
app.use('/transactions', transactionsRoutes);
app.use('/auth', loginRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

// Database connection
connectToDatabase()
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .catch(error => {
    console.error('Database connection error:', error);
    process.exit(1);
  });

export default app;
