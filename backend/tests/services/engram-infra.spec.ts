// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll } from 'vitest'
import { probeEngramInfrastructure } from '../../src/services/engram-infra.js'
import type { InfrastructureStatus } from '../../src/services/engram-infra.js'

// All Engram services (LLM, embedding, pipeline, pgvector) are unreachable in the
// test environment. ECONNREFUSED fails immediately — no 2s timeout wait.
// We validate shape and logic invariants using the down-state result.

let result: InfrastructureStatus

beforeAll(async () => {
  result = await probeEngramInfrastructure()
}, 10_000)

describe('probeEngramInfrastructure', () => {
  it('returns correct shape for all four components', () => {
    for (const key of ['llm', 'embedding', 'pipeline', 'pgvector'] as const) {
      expect(typeof result[key].available).toBe('boolean')
      expect(result[key].latencyMs === null || typeof result[key].latencyMs === 'number').toBe(true)
      expect(result[key].detail === null || typeof result[key].detail === 'string').toBe(true)
    }
  })

  it('polledAt is a recent timestamp', () => {
    expect(typeof result.polledAt).toBe('number')
    expect(result.polledAt).toBeGreaterThan(Date.now() - 30_000)
  })

  it('headroomPer15s is null when embedding is unavailable', () => {
    if (!result.embedding.available) {
      expect(result.embedding.headroomPer15s).toBeNull()
    }
  })

  it('headroomPer15s is a positive integer when embedding is available', () => {
    if (result.embedding.available && result.embedding.latencyMs) {
      expect(typeof result.embedding.headroomPer15s).toBe('number')
      expect(result.embedding.headroomPer15s).toBeGreaterThan(0)
      expect(result.embedding.headroomPer15s).toBe(Math.floor(15000 / result.embedding.latencyMs))
    }
  })

  it('gradual is always feasible regardless of infrastructure state', () => {
    expect(result.methodFeasibility.gradual).toBe(true)
  })

  it('method feasibility matches capability requirements', () => {
    const e = result.embedding.available
    const p = result.pipeline.available
    const pg = result.pgvector.available
    expect(result.methodFeasibility.additive).toBe(e)
    expect(result.methodFeasibility.priorityTrickle).toBe(e && p)
    expect(result.methodFeasibility.bulkReprocess).toBe(e && p)
    expect(result.methodFeasibility.parallelAtomic).toBe(e && p && pg)
  })

  it('methodFeasibility contains exactly the expected keys', () => {
    const keys = Object.keys(result.methodFeasibility).sort()
    expect(keys).toEqual(['additive', 'bulkReprocess', 'gradual', 'parallelAtomic', 'priorityTrickle'])
  })
})
