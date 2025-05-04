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
