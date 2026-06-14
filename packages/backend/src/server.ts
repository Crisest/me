import https from 'https';
import http from 'http';
import fs from 'fs';
import app from './app';
import mongoose from 'mongoose';
import { config } from './config/env';
import { connectToDatabase } from './db/db';

const PORT = config.port;

const { sslCertPath, sslKeyPath } = config;

let server: http.Server | https.Server | undefined;

async function bootstrap() {
  try {
    await connectToDatabase();
    console.log('MongoDB connected successfully');
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
const shutdown = async () => {
  console.log('Shutting down gracefully...');

  // Close DB connection
  await mongoose.disconnect();

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
process.on('SIGINT', shutdown); // Ctrl+C
process.on('SIGTERM', shutdown); // System signals
