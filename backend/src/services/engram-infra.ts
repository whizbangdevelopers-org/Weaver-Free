// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

import { Pool } from 'pg'

// Service URLs — override via env vars to match the deployment config.
const LLM_URL      = process.env.ENGRAM_LLM_URL      ?? 'http://127.0.0.1:8769'
const EMBED_URL    = process.env.ENGRAM_EMBED_URL     ?? 'http://127.0.0.1:8767'
const PIPELINE_URL = process.env.ENGRAM_PIPELINE_URL  ?? 'http://127.0.0.1:8765'

const PG_HOST     = process.env.PGVECTOR_HOST     ?? '127.0.0.1'
const PG_PORT     = parseInt(process.env.PGVECTOR_PORT ?? '5432', 10)
const PG_USER     = process.env.PGVECTOR_USER     ?? 'cognee'
const PG_PASSWORD = process.env.PGVECTOR_PASSWORD ?? 'cognee-local'
const PG_DB       = process.env.PGVECTOR_DB       ?? 'cognee'

const PROBE_TIMEOUT_MS = 2000

export interface ComponentStatus {
  available: boolean
  latencyMs: number | null
  detail: string | null
}

export interface InfrastructureStatus {
  llm:       ComponentStatus
  embedding: ComponentStatus & { headroomPer15s: number | null }
  pipeline:  ComponentStatus
  pgvector:  ComponentStatus
  methodFeasibility: {
    gradual:         boolean
    additive:        boolean
    priorityTrickle: boolean
    bulkReprocess:   boolean
    parallelAtomic:  boolean
  }
  polledAt: number
}

async function probeHttp(url: string): Promise<ComponentStatus> {
  const start = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    return { available: res.status < 500, latencyMs: Date.now() - start, detail: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unreachable'
    return { available: false, latencyMs: null, detail: msg }
  }
}

async function probePgvector(): Promise<ComponentStatus> {
  const pool = new Pool({
    host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASSWORD, database: PG_DB,
    connectionTimeoutMillis: PROBE_TIMEOUT_MS, max: 1,
  })
  const start = Date.now()
  try {
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    return { available: true, latencyMs: Date.now() - start, detail: null }
  } catch (err) {
    return { available: false, latencyMs: null, detail: err instanceof Error ? err.message : 'Unreachable' }
  } finally {
    await pool.end().catch(() => {})
  }
}

export async function probeEngramInfrastructure(): Promise<InfrastructureStatus> {
  const [llm, embedding, pipeline, pgvector] = await Promise.all([
    probeHttp(`${LLM_URL}/health`),
    probeHttp(`${EMBED_URL}/health`),
    probeHttp(`${PIPELINE_URL}/health`),
    probePgvector(),
  ])

  const headroomPer15s = embedding.available && embedding.latencyMs
    ? Math.floor(15000 / embedding.latencyMs)
    : null

  return {
    llm,
    embedding: { ...embedding, headroomPer15s },
    pipeline,
    pgvector,
    methodFeasibility: {
      gradual:         true,
      additive:        embedding.available,
      priorityTrickle: embedding.available && pipeline.available,
      bulkReprocess:   embedding.available && pipeline.available,
      parallelAtomic:  embedding.available && pipeline.available && pgvector.available,
    },
    polledAt: Date.now(),
  }
}
