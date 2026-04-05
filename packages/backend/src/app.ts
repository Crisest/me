import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { requestLogger } from './middleware/requestLogger';
import { connectToDatabase } from './db/db';
import transactionsRoutes from './modules/transactions';
import loginRoutes from './modules/auth';
import bankRoutes from './modules/banks/bank.routes';
import cardRoutes from './modules/cards/card.routes';
import budgetRoutes from './modules/budget';
import uploadRoutes from './modules/uploads';
import groupRoutes from './modules/groups/group.routes';
import devRoutes from './modules/dev';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { getConfig } from './config/env';
import { errorHandler } from './middleware/errorHandler';
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
app.use('/banks', bankRoutes);
app.use('/cards', cardRoutes);
app.use('/budget', budgetRoutes);
app.use('/uploads', uploadRoutes);
app.use('/groups', groupRoutes);
if (config.nodeEnv !== 'production') {
  app.use('/dev', devRoutes);
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
