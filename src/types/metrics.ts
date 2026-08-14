// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * One resource sample.
 *
 * Every value is NULLABLE and that is the contract, not laxity: null means "this could not be
 * determined", which is a different fact from a measured zero. The backend keeps the two apart
 * through the cgroup parser, the ring buffer and the response schema; collapsing them here would
 * undo all of it at the last hop, and a chart cannot tell an idle workload from an unobserved one
 * once that has happened.
 */
export interface MetricSample {
  timestamp: number
  cpuPercent: number | null
  memoryBytes: number | null
  /** Disk THROUGHPUT in bytes/sec, from cgroup `io.stat` counters — not disk usage. */
  diskReadBps: number | null
  diskWriteBps: number | null
}

/** The metrics endpoint response. `windowMs` is what was SERVED, which may be less than asked. */
export interface WorkloadMetrics {
  name: string
  windowMs: number
  intervalMs: number
  samples: MetricSample[]
}

/**
 * The demo layer's own metric shape, kept as-is.
 *
 * It predates the real endpoint and differs in every field that matters: ISO-string timestamps,
 * megabytes rather than bytes, disk throughput rather than usage, and — the important one — no
 * nulls, because synthetic data is never unmeasurable.
 *
 * Not merged into `MetricSample`. Widening the demo shape to nullable would put nulls into
 * `demo-data.ts`'s generators, where they cannot occur and would only ever be dead branches; and
 * narrowing `MetricSample` to non-null would destroy the unknown/idle distinction the entire
 * backend chain exists to preserve. They convert at one seam instead — `mockWorkloadMetrics`.
 */
export interface MetricPoint {
  timestamp: string
  cpuPercent: number
  memoryMb: number
  diskReadMbps: number
  diskWriteMbps: number
}

export interface VmMetrics {
  vmName: string
  resolution: '1m' | '5m'
  points: MetricPoint[]
}
