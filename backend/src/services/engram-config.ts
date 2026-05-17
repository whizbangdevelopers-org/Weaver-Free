// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

// Single source of truth for Engram service connection configuration.
// All values are driven by env vars — no magic strings in call sites.
//
// NixOS: set via services.weaver.engram.* options (generates env vars at service start).
// Dev:   set in .env or shell; defaults target the standard local install.
//
// Env var reference:
//   ENGRAM_PG_HOST            PG host            (default: 127.0.0.1)
//   ENGRAM_PG_PORT            PG port            (default: 5432)
//   ENGRAM_PG_USER            PG role            (default: engram)
//   ENGRAM_PG_DATABASE        PG database        (default: engram)
//   ENGRAM_PG_PASSWORD        PG password        (default: engram-local)
//   ENGRAM_PG_PASSWORD_FILE   Path to PG password file (takes precedence over ENGRAM_PG_PASSWORD)
//   ENGRAM_COGNEE_URL         Cognee sidecar URL (default: http://127.0.0.1:8765)
//   ENGRAM_COGNEE_EMAIL       Cognee account     (required — empty = auth unavailable)
//   ENGRAM_COGNEE_PASSWORD    Cognee password    (required — empty = auth unavailable)
//   ENGRAM_COGNEE_PASSWORD_FILE  Path to Cognee password file (takes precedence)
//   ENGRAM_EMBED_URL          Embedding service  (default: http://127.0.0.1:8767)
//   ENGRAM_LLM_URL            LLM gen service    (default: http://127.0.0.1:8769)
//   ENGRAM_PIPELINE_URL       Cognee pipeline    (default: http://127.0.0.1:8765)

import { readFileSync } from 'node:fs'

function readSecretFile(fileEnvVar: string, fallback: string): string {
  const filePath = process.env[fileEnvVar]
  if (filePath) {
    try { return readFileSync(filePath, 'utf8').trim() } catch { /* fall through */ }
  }
  return fallback
}

export const engramConfig = {
  pg: {
    host:     process.env.ENGRAM_PG_HOST     ?? '127.0.0.1',
    port:     parseInt(process.env.ENGRAM_PG_PORT ?? '5432', 10),
    user:     process.env.ENGRAM_PG_USER     ?? 'engram',
    database: process.env.ENGRAM_PG_DATABASE ?? 'engram',
    password: readSecretFile('ENGRAM_PG_PASSWORD_FILE', process.env.ENGRAM_PG_PASSWORD ?? 'engram-local'),
  },
  cognee: {
    url:      process.env.ENGRAM_COGNEE_URL   ?? 'http://127.0.0.1:8765',
    email:    process.env.ENGRAM_COGNEE_EMAIL ?? '',
    password: readSecretFile('ENGRAM_COGNEE_PASSWORD_FILE', process.env.ENGRAM_COGNEE_PASSWORD ?? ''),
  },
  embedding: {
    url: process.env.ENGRAM_EMBED_URL ?? 'http://127.0.0.1:8767',
  },
  llm: {
    url: process.env.ENGRAM_LLM_URL ?? 'http://127.0.0.1:8769',
  },
  pipeline: {
    url: process.env.ENGRAM_PIPELINE_URL ?? 'http://127.0.0.1:8765',
  },
}
