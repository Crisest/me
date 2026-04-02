# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Full-stack personal portfolio/finance app using a pnpm monorepo with three packages:
- `packages/common` — shared TypeScript types and utilities (built first, consumed by both frontend and backend)
- `packages/backend` — Express.js REST API with MongoDB/Mongoose
- `packages/frontend` — React SPA with Redux Toolkit Query

## Commands

All commands run from the repo root unless noted.

```bash
# Install dependencies
pnpm install

# Build common first (required before running frontend/backend)
pnpm run common:build

# Start everything (backend with bunyan pretty-print + frontend dev server)
pnpm run start:all

# Individual services
pnpm run backend:dev       # ts-node-dev with hot reload
pnpm run frontend:dev      # Vite dev server (http://localhost:5173)

# Build
pnpm run build             # all packages
pnpm run common:build      # common only

# Lint and format
pnpm run lint
pnpm run lint:fix
pnpm run format
```

> **After any change to `packages/common/src`**, run `pnpm run common:build` (or `cd packages/common && pnpm run dev` to watch).

## Architecture

### Backend (`packages/backend`)

Module-based structure under `src/modules/`. Each domain module (auth, banks, cards, budget, transactions, groups, fixedTransactions) follows the pattern:

```
module/
  *.model.ts       # Mongoose schema/model
  *.service.ts     # Business logic (calls model)
  *.controller.ts  # Request/response handling (calls service)
  *.routes.ts      # Express Router (applies authMiddleware + controller)
  index.ts         # Re-exports + default exports routes
```

All routes are mounted in `src/app.ts`. Authentication is cookie-based JWT via `authMiddleware` from `modules/auth`. Protected routes pass through `authMiddleware`, which attaches `req.user`.

**Key utilities:**
- `src/utils/logger.ts` — Bunyan logger
- `src/middleware/requestLogger.ts` — attaches per-request Bunyan child logger as `req.log` with ULID sequence ID
- `src/middleware/validateRequest.ts` — wraps express-validator chains, throws `AppError` on failure
- `src/middleware/errorHandler.ts` — centralised error handler using `AppError`
- `src/config/env.ts` — all config (port 3000, MongoDB URI, JWT secret, frontend URL)

**Environment variables** (in `packages/backend/.env`): `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`

### Frontend (`packages/frontend`)

- **State/data fetching**: Redux Toolkit Query (`apiSlice` in `src/services/apiSlice.ts`) as the single API layer. Domain services (e.g. `transactionService.ts`, `bankService.ts`) inject endpoints into `apiSlice` using `injectEndpoints`.
- **Routing**: React Router v6. Routes defined in `src/routes/index.tsx`. Protected routes use `<PrivateRoutes>` wrapper. Route paths are enums in `src/enums/routerEnum.ts`.
- **Modules**: Page-level features live in `src/modules/` (Auth, budget, groups, home, projects).
- **Components**: Shared UI in `src/components/`. Notable: `Layout`, `Sidebar`, `TransactionsTable`, `YmCombobox`, `YmDialog`.
- **Path alias**: `@/` maps to `src/` (configured in Vite and tsconfig).

### Common (`packages/common`)

Only TypeScript types and utilities — no runtime dependencies. Everything is exported from `src/index.ts`. Types include payload namespaces (e.g. `TransactionPayloads.GetMany`, `TransactionPayloads.Create`) used to keep frontend/backend in sync.

## Key Patterns

- **Backend validation**: use `validateRequest([...validationChains])` middleware in routes before controllers.
- **Backend logging in request handlers**: use `req.log` (Bunyan child logger) instead of `console.log`.
- **Frontend API calls**: extend `apiSlice` via `injectEndpoints` in the relevant service file; do not create separate fetch calls.
- **Shared types**: define new types in `packages/common/src/types/`, export from `src/index.ts`, rebuild common before use.
