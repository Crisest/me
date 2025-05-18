# Portfolio 2024

A full-stack application using TypeScript, React, and Node.js, organized as a monorepo with pnpm workspaces.

## Prerequisites

- Node.js v22.5.1 (specified in .nvmrc)
- pnpm v8.15.4 or higher

## Project Structure

```
packages/
├── backend/     # Express.js backend server
├── common/      # Shared types and utilities
└── frontend/    # React frontend application
```

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Build the common package first:

```bash
pnpm run common:build
```

3. Start all services in development mode:

```bash
pnpm run start:all
```

## Available Scripts

### Root Level Scripts

- `pnpm run build` - Build all packages
- `pnpm run dev` - Start all packages in development mode
- `pnpm run clean` - Remove node_modules and dist directories from all packages
- `pnpm run lint` - Lint all packages
- `pnpm run lint:fix` - Fix linting issues in all packages
- `pnpm run format` - Format code in all packages

### Individual Package Scripts

Frontend (`packages/frontend`):

- `pnpm run frontend:dev` - Start frontend development server
- `pnpm run frontend:build` - Build frontend for production

Backend (`packages/backend`):

- `pnpm run backend:dev` - Start backend development server
- `pnpm run backend:build` - Build backend for production

Common (`packages/common`):

- `pnpm run common:build` - Build common package

## Working with the Common Package

The common package contains shared types and utilities used by both frontend and backend. When making changes to the common package:

1. Make your changes in `packages/common/src`
2. Build the common package:

```bash
pnpm run common:build
```

3. The changes will be automatically reflected in dependent packages due to workspace references

### Watching Common Package Changes

During development, you can watch for changes in the common package:

```bash
# In one terminal
cd packages/common
pnpm run dev

# In separate terminals
pnpm run frontend:dev
pnpm run backend:dev
```

This will automatically rebuild the common package when changes are made, and the frontend and backend will pick up the changes through their workspace dependencies.

## Development Tips

- The frontend runs on http://localhost:5173 by default (Vite)
- The backend runs on http://localhost:3000 by default
- Use `pnpm run start:all` to run both frontend and backend concurrently
- Always build the common package after making changes to shared types or utilities

## Logging

The application uses a structured logging system based on Bunyan with sequence ID tracking for request tracing.

### Log Levels

The logging system supports the following levels (in order of increasing severity):

- `TRACE` - Very detailed debugging
- `DEBUG` - Debugging information
- `INFO` - Normal operation logs
- `WARN` - Warning messages
- `ERROR` - Error conditions
- `FATAL` - System is unusable

In production, only `INFO` and above are logged. In development, `DEBUG` and above are logged.

### Request Tracking

Each HTTP request is automatically assigned a unique sequence ID using ULID. This allows for easy tracking of requests across the system. Every log entry related to a request includes:

- Sequence ID
- Timestamp
- Log level
- Request method and URL
- Response time (for completed requests)
- Additional context provided by the code

### Usage Examples

In request handlers:

```typescript
// Log with request context
req.log.info({ userId: '123' }, 'User action completed');

// Create a child logger for a specific context
const log = req.log.child({ action: 'createUser' });
log.info({ email }, 'Starting user creation');

// Log errors
log.error({ err, userId }, 'Operation failed');
```

### Log Output Format

Logs are output in JSON format for easy parsing. Example:

```json
{
  "name": "portfolio-api",
  "hostname": "server",
  "pid": 1234,
  "level": 30,
  "sequenceId": "01HQ2XBVN5QBRKJ39BMKS6PSDT",
  "method": "POST",
  "url": "/api/users",
  "msg": "Request completed",
  "time": "2025-05-17T10:30:00.000Z",
  "v": 0
}
```

### Configuration

Logging configuration can be adjusted in `packages/backend/src/config/env.ts`:

- `nodeEnv`: Controls log level (`production` = INFO+, `development` = DEBUG+)
- Add custom configuration by extending the config object

For development, you can use the Bunyan CLI to pretty-print logs:

```bash
pnpm run backend:dev | npx bunyan
```

#### Development Tip

Instead of piping to npx bunyan every time, you can add the bunyan CLI to your package.json scripts:

```json
{
  "scripts": {
    "dev:pretty": "pnpm run dev | bunyan"
  }
}
```

Then install bunyan as a dev dependency:

```bash
cd packages/backend
pnpm add -D bunyan
```
