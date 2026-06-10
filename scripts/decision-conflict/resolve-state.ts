// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * resolve-state — amendment-chain walker (highest-risk logic, tested directly).
 *
 * A decision's *current effective state* is not its original body — a later
 * decision may have amended or superseded it. `resolveDecisionState(n)` walks
 * the chain forward and returns the chain plus the latest (effective) decision.
 *
 * Edges come from two directions in the table and we union both so the chain
 * is robust to which side recorded the relation:
 *   - the ORIGINAL row declares `*Amended by #M*` / `Superseded by #M`
 *   - the AMENDING row declares `Amends #N` / `Supersedes #N`
 *
 * Worked examples (verify by hand against MASTER-PLAN.md):
 *   - #3  amended by #96   → effective = #96 (à la carte retired)
 *   - #41 amended by #49   → effective = #49 (quarterly option added)
 *   - #76 amended by #185  → effective = #185 (Team is a first-class 4th tier)
 *   - #87 amended by #185  → effective = #185
 *
 * Cycle defense: a malformed table could record A→B and B→A. The walker
 * tracks visited numbers, breaks on revisit, logs once, and returns the
 * latest-by-number node reached — never loops forever.
 */

import type { DecisionRow } from './parse-decisions.ts'

export interface ResolvedDecision {
  /** The decision number the resolution was requested for. */
  requested: number
  /** Ordered chain of decision numbers walked (origin → … → effective). */
  chain: number[]
  /** The decision row that is currently in effect for `requested`. */
  effective: DecisionRow
  /** The original row for `requested` (unwalked). */
  original: DecisionRow
  /** True if the chain was truncated due to a detected cycle. */
  cyclic: boolean
}

export function buildIndex(rows: DecisionRow[]): Map<number, DecisionRow> {
  const index = new Map<number, DecisionRow>()
  for (const r of rows) index.set(r.number, r)
  return index
}

/**
 * Compute the set of decisions that amend/supersede `row`, unioning the
 * edges declared on `row` itself with the inverse edges declared by other
 * rows (`Amends #row.number` / `Supersedes #row.number`).
 */
function forwardEdges(row: DecisionRow, rows: DecisionRow[]): number[] {
  const next = new Set<number>([...row.amendedBy, ...row.supersededBy])
  for (const other of rows) {
    if (other.amends.includes(row.number)) next.add(other.number)
    if (other.supersedes.includes(row.number)) next.add(other.number)
  }
  // Only follow edges that move FORWARD (to a higher-numbered, later
  // decision). An amendment is always a later decision; this also makes
  // the walk monotone, which is the structural guard against cycles.
  return [...next].filter((n) => n > row.number).sort((a, b) => a - b)
}

/**
 * Walk the amendment chain for `decisionNumber` and return the effective
 * state. Optionally pass a logger (defaults to console.warn) so callers/tests
 * can assert on the cycle-defense log.
 */
export function resolveDecisionState(
  decisionNumber: number,
  rows: DecisionRow[],
  log: (msg: string) => void = (m) => console.warn(m),
): ResolvedDecision {
  const index = buildIndex(rows)
  const original = index.get(decisionNumber)
  if (!original) {
    throw new Error(`resolveDecisionState: decision #${decisionNumber} not found`)
  }

  const chain: number[] = [decisionNumber]
  const visited = new Set<number>([decisionNumber])
  let current = original
  let cyclic = false

  // Each step jumps to the LATEST decision that amends/supersedes `current`.
  // Because edges are filtered to strictly-higher numbers, the walk is
  // monotone increasing and must terminate; the visited-set is belt-and-
  // suspenders against a pathological table.
  for (;;) {
    const edges = forwardEdges(current, rows)
    if (edges.length === 0) break

    // Prefer the highest-numbered amender as "most recent effective state".
    const nextNum = edges[edges.length - 1]!
    if (visited.has(nextNum)) {
      cyclic = true
      log(
        `resolveDecisionState: cycle detected at decision #${nextNum} ` +
          `(chain ${chain.join(' -> ')}); returning latest reachable state.`,
      )
      break
    }
    const nextRow = index.get(nextNum)
    if (!nextRow) {
      // Dangling amendment target — decision-parity guards this separately;
      // here we just stop walking and keep the last valid node.
      break
    }
    visited.add(nextNum)
    chain.push(nextNum)
    current = nextRow
  }

  return { requested: decisionNumber, chain, effective: current, original, cyclic }
}

/** Resolve every decision once. */
export function resolveAll(
  rows: DecisionRow[],
  log?: (msg: string) => void,
): Map<number, ResolvedDecision> {
  const out = new Map<number, ResolvedDecision>()
  for (const r of rows) out.set(r.number, resolveDecisionState(r.number, rows, log))
  return out
}
