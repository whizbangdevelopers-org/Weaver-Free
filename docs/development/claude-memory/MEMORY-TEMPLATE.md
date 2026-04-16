<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# {{PRODUCT_NAME}} Project Memory

## Tech Stack
- Frontend: Quasar 2 + Vue 3 + TypeScript + Pinia
- Backend: Fastify 4 + TypeScript + Zod
- Testing: Vitest (unit) | Playwright in Docker (E2E) | Build: Vite via Quasar CLI

## Port Layout
| Purpose | Frontend | Backend |
|---------|----------|---------|
| Dev | 9000 | 3000 |
| E2E | 9020 | 3120 |

## Storage
- Default: JSON file-based (`STORAGE_BACKEND=json`)
- Optional: PostgreSQL (`STORAGE_BACKEND=postgres`)
- Adapter pattern: `backend/src/storage/`

## Key Patterns
- Config: env var → `*_FILE` variant → default (see `backend/src/config.ts`)
- Auth: JWT middleware in `backend/src/middleware/auth.ts`
- RBAC: `requireRole('admin')` preHandler factory
- Validation: Zod schemas for ALL requests AND responses (including error codes)
- Error handling: log full errors server-side, return sanitized messages to client

## E2E Testing
- ALWAYS via Docker: `testing/e2e-docker/scripts/run-tests.sh`
- Fast iteration: `testing/e2e-docker/scripts/run-iterate.sh`
- Failure triage: `node testing/e2e-docker/scripts/analyze-results.mjs`
- Flaky detection: `testing/e2e-docker/scripts/detect-flaky.sh`
