<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Database Testing for Quasar Node.js Templates

> **Applies to:** quasar-template-fullstack-mariadb, quasar-template-fullstack-postgres, quasar-template-fullstack-trpc, quasar-template-pwa-api

## Overview

Database testing infrastructure for Quasar templates with Node.js/Fastify backends. Supports MariaDB, PostgreSQL, and SQLite.

## Quick Start

```bash
# Start database container
make db-up

# Run unit tests (mocked)
npm run test:unit

# Run integration tests (real database)
npm run test:integration

# Test all supported engines
make test-matrix

# Database shell access
make db-shell
```

---

## Project Structure

```
project/
├── backend/
│   ├── src/
│   │   ├── routes/           # Fastify routes
│   │   ├── db/               # Database connection
│   │   └── index.ts          # Server entry
│   ├── tests/
│   │   ├── unit/             # Mocked tests
│   │   ├── integration/      # Real DB tests
│   │   └── setup.ts          # Test helpers
│   └── package.json
│
├── src/                      # Quasar frontend
├── docker/
│   └── docker-compose.test.yml
├── config/
│   └── databases.test.json
├── scripts/
│   ├── wait-for-db.sh
│   └── db-shell.sh
└── Makefile
```

---

## Docker Compose Services

File: `docker/docker-compose.test.yml`

```yaml
services:
  mariadb:
    image: mariadb:11
    environment:
      MARIADB_ROOT_PASSWORD: test
      MARIADB_DATABASE: testdb
    tmpfs: /var/lib/mysql
    ports:
      - "3306:3306"
    healthcheck:
      test: ["CMD", "mariadb-admin", "ping", "-ptest"]
      interval: 2s
      timeout: 5s
      retries: 10

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: test
      POSTGRES_DB: testdb
    tmpfs: /var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      timeout: 5s
      retries: 10
```

**Notes:**
- `tmpfs` mounts databases in RAM for fast tests
- Health checks enable reliable startup detection
- SQLite requires no container (uses local file)

---

## Database Configuration

File: `config/databases.test.json`

```json
{
  "mariadb": {
    "driver": "mysql",
    "host": "localhost",
    "port": 3306,
    "database": "testdb",
    "username": "root",
    "password": "test"
  },
  "postgres": {
    "driver": "pgsql",
    "host": "localhost",
    "port": 5432,
    "database": "testdb",
    "username": "postgres",
    "password": "test"
  },
  "sqlite": {
    "driver": "sqlite",
    "database": "tests/test.db"
  }
}
```

---

## Makefile

```makefile
DB_ENGINE ?= postgres
COMPOSE_FILE := docker/docker-compose.test.yml

.PHONY: db-up db-down db-logs db-shell test-unit test-integration test-matrix

db-up:
	docker compose -f $(COMPOSE_FILE) up -d $(DB_ENGINE)
	@./scripts/wait-for-db.sh $(DB_ENGINE)
	@echo "✓ $(DB_ENGINE) ready"

db-down:
	docker compose -f $(COMPOSE_FILE) down -v

db-logs:
	docker compose -f $(COMPOSE_FILE) logs -f $(DB_ENGINE)

db-shell:
	@./scripts/db-shell.sh $(DB_ENGINE)

test-unit:
	cd backend && npm run test:unit

test-integration: db-up
	cd backend && DB_ENGINE=$(DB_ENGINE) npm run test:integration
	$(MAKE) db-down

test-matrix:
	@for engine in mariadb postgres; do \
		echo ""; \
		echo "═══════════════════════════════════════"; \
		echo "  Testing with $$engine"; \
		echo "═══════════════════════════════════════"; \
		$(MAKE) test-integration DB_ENGINE=$$engine || exit 1; \
	done
	@echo ""
	@echo "✓ All database engines passed"
```

---

## Test Setup

File: `backend/tests/setup.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';

interface DbConfig {
  driver: string;
  host: string;
  port: number;
  database?: string;
  username: string;
  password: string;
}

export function getDbConfig(): DbConfig {
  const engine = process.env.DB_ENGINE || 'postgres';
  const configPath = path.join(__dirname, '..', '..', 'config', 'databases.test.json');
  const allConfigs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return allConfigs[engine];
}

export async function createConnection() {
  const config = getDbConfig();

  switch (config.driver) {
    case 'mysql': {
      const mysql = await import('mysql2/promise');
      return mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
      });
    }
    case 'pgsql': {
      const { Client } = await import('pg');
      const client = new Client({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
      });
      await client.connect();
      return client;
    }
    case 'sqlite': {
      const Database = (await import('better-sqlite3')).default;
      return new Database(config.database);
    }
    default:
      throw new Error(`Unknown driver: ${config.driver}`);
  }
}

export async function closeConnection(conn: unknown) {
  if (!conn) return;

  const config = getDbConfig();
  switch (config.driver) {
    case 'mysql':
      await (conn as { end: () => Promise<void> }).end();
      break;
    case 'pgsql':
      await (conn as { end: () => Promise<void> }).end();
      break;
    case 'sqlite':
      (conn as { close: () => void }).close();
      break;
  }
}
```

---

## Example Integration Test

File: `backend/tests/integration/items.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createConnection, closeConnection } from '../setup';

describe('Items Repository', () => {
  let db: unknown;

  beforeAll(async () => {
    db = await createConnection();
    // Run migrations or seed data here
  });

  afterAll(async () => {
    await closeConnection(db);
  });

  it('should insert and retrieve an item', async () => {
    // Test implementation varies by driver
    // Use raw SQL or your ORM of choice
  });
});
```

---

## GitHub Actions CI

File: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: cd backend && npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    strategy:
      fail-fast: false
      matrix:
        db: [mariadb, postgres]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: cd backend && npm ci

      - name: Start ${{ matrix.db }}
        run: make db-up DB_ENGINE=${{ matrix.db }}

      - name: Run integration tests
        run: make test-integration DB_ENGINE=${{ matrix.db }}

      - name: Cleanup
        if: always()
        run: make db-down
```

---

## Package.json Scripts

Add to `backend/package.json`:

```json
{
  "scripts": {
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test": "vitest"
  },
  "devDependencies": {
    "vitest": "^1.1.0",
    "@types/node": "^20.0.0"
  },
  "dependencies": {
    "mysql2": "^3.6.0",
    "pg": "^8.11.0",
    "better-sqlite3": "^9.4.0"
  }
}
```

---

## Helper Scripts

### wait-for-db.sh

```bash
#!/usr/bin/env bash
set -e

DB_ENGINE=${1:-postgres}
MAX_ATTEMPTS=30
ATTEMPT=0

echo "Waiting for $DB_ENGINE to be ready..."

case $DB_ENGINE in
  mariadb)
    until docker compose -f docker/docker-compose.test.yml exec -T mariadb \
      mariadb-admin ping -ptest --silent 2>/dev/null; do
      ATTEMPT=$((ATTEMPT + 1))
      [ $ATTEMPT -ge $MAX_ATTEMPTS ] && echo "ERROR: MariaDB failed" && exit 1
      sleep 1
    done
    ;;
  postgres)
    until docker compose -f docker/docker-compose.test.yml exec -T postgres \
      pg_isready -U postgres --quiet 2>/dev/null; do
      ATTEMPT=$((ATTEMPT + 1))
      [ $ATTEMPT -ge $MAX_ATTEMPTS ] && echo "ERROR: PostgreSQL failed" && exit 1
      sleep 1
    done
    ;;
  sqlite)
    mkdir -p tests
    ;;
esac

echo "✓ $DB_ENGINE is ready (took ~${ATTEMPT}s)"
```

### db-shell.sh

```bash
#!/usr/bin/env bash
DB_ENGINE=${1:-postgres}

case $DB_ENGINE in
  mariadb)
    docker compose -f docker/docker-compose.test.yml exec mariadb mariadb -ptest testdb
    ;;
  postgres)
    docker compose -f docker/docker-compose.test.yml exec postgres psql -U postgres testdb
    ;;
  sqlite)
    sqlite3 tests/test.db
    ;;
esac
```

---

## Template-Specific Notes

| Template | Default DB | Notes |
| -------- | ---------- | ----- |
| fullstack-mariadb | MariaDB | Uses mysql2 driver |
| fullstack-postgres | PostgreSQL | Uses pg driver |
| fullstack-trpc | PostgreSQL | tRPC with Prisma ORM |
| pwa-api | PostgreSQL | Fastify + Zod validation |

---

*For Quasar templates with Java backends, see DATABASE-TESTING-QUARKUS.md or DATABASE-TESTING-SPRING.md*
