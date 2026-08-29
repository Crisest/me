import https from 'https';
import http from 'http';
import fs from 'fs';
import app from './app';
import { config } from './config/env';
import { connectToDatabase } from './db/db';
import { closeDb } from './db/client';
import logger from './utils/logger';

const PORT = config.port;

const { sslCertPath, sslKeyPath } = config;

let server: http.Server | https.Server | undefined;

async function bootstrap() {
  try {
    await connectToDatabase();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }

  if (sslCertPath && sslKeyPath) {
    const sslOptions = {
      cert: fs.readFileSync(sslCertPath),
      key: fs.readFileSync(sslKeyPath),
    };
    server = https.createServer(sslOptions, app).listen(PORT, () => {
      console.log(`HTTPS server is running on port ${PORT}`);
    });
  } else {
    server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  }
}

bootstrap();

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log('Shutting down gracefully...');
  logger.info({ signal }, 'Shutting down, draining database pool');

  // Close DB connections
  await closeDb();

  // Close HTTP server
  server?.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });

  // If server hasn't closed after 10 seconds, force shutdown
  setTimeout(() => {
    console.error('Force shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

// Catch termination signals and call the shutdown function
process.on('SIGINT', () => void shutdown('SIGINT')); // Ctrl+C
process.on('SIGTERM', () => void shutdown('SIGTERM')); // System signals
