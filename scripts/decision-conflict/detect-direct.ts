// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * detect-direct — Layer 1: pattern-based contradiction detection.
 *
 * Cheap, high-confidence. Each pattern in the config's `claim_patterns`
 * encodes a class of claim that contradicts a (resolved) decision: a retired
 * tier name used as current, a renamed program term, or a retired model being
 * proposed. A match becomes a {@link Conflict} citing the decision number.
 *
 * False-positive guards (do NOT flag):
 *   - lines inside a Decisions Resolved table row (`| N | ... |`) — that text
 *     IS the source of truth, not a claim against it
 *   - explicitly-historical references ("originally called premium",
 *     "renamed by #137", "(historical)", "was Premium", "formerly Enterprise")
 *   - lines naming the decision itself ("Decision #137") — discussing a
 *     decision is not contradicting it
 *   - exempted (file, decision) pairs with a justification
 *
 * Patterns are intentionally narrow (tier-NAME usage, not adjectival
 * "premium" / generic "enterprise-grade"); this mirrors the calibrated
 * vocabulary-sync auditor and keeps the historical corpus green while still
 * catching genuine "used as current" drift.
 */

import type { Conflict } from './report.ts'
import type { DecisionRow } from './parse-decisions.ts'
import { resolveDecisionState } from './resolve-state.ts'

export interface ClaimPattern {
  decision_number: number
  pattern: string
  message: string
  suggestion?: string
  severity?: string
}

export interface Exemption {
  file: string
  decision_number: number
  justification: string
}

/** A line that explicitly contextualizes an old term as historical → ignore. */
const HISTORICAL_GUARD =
  /\b(?:originally|formerly|previously|used to be|was)\b.*\b(?:premium|enterprise|early adopter|EA|à la carte|a la carte)\b|\(historical\)|\brenamed\b|\bretired\b|\bdeprecated\b|→\s*(?:Weaver|Fabrick|Founding Member|FM)|Decision #\d+\b.*\b(?:rename|renamed|retire|retired)\b/i

/** A Decisions-Resolved table row — its content is source of truth. */
const DECISION_TABLE_ROW = /^\s*\| \d+ \|/

export interface DetectDirectOptions {
  filePath: string
  content: string
  rows: DecisionRow[]
  patterns: ClaimPattern[]
  exemptions: Exemption[]
}

/** Short, human-readable effective-state summary for the report. */
function resolvedSummary(decisionNumber: number, rows: DecisionRow[]): string {
  try {
    const resolved = resolveDecisionState(decisionNumber, rows, () => {})
    const eff = resolved.effective
    const chainNote =
      resolved.chain.length > 1 ? ` (effective via amendment chain ${resolved.chain.join(' → ')})` : ''
    const title = eff.title.replace(/\s+/g, ' ').trim()
    return `#${eff.number} ${title}${chainNote}`
  } catch {
    return `#${decisionNumber} (decision not found in MASTER-PLAN.md)`
  }
}

export function detectDirect(opts: DetectDirectOptions): Conflict[] {
  const { filePath, content, rows, patterns, exemptions } = opts
  const conflicts: Conflict[] = []
  const lines = content.split('\n')
  // One conflict per (line, decision) — multiple patterns can target the same
  // decision, but a single line contradicting one decision is one finding.
  const seen = new Set<string>()

  const exemptFor = (decisionNumber: number): boolean =>
    exemptions.some(
      (e) =>
        e.decision_number === decisionNumber &&
        e.justification.trim().length > 0 &&
        filePath.endsWith(e.file),
    )

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // Guard 1: source-of-truth table rows.
    if (DECISION_TABLE_ROW.test(line)) continue
    // Guard 2: explicit historical contextualization.
    if (HISTORICAL_GUARD.test(line)) continue

    for (const cp of patterns) {
      if (exemptFor(cp.decision_number)) continue

      let re: RegExp
      try {
        re = new RegExp(cp.pattern)
      } catch {
        // A malformed pattern is a config error, not a silent skip.
        throw new Error(`detect-direct: invalid regex for decision #${cp.decision_number}: ${cp.pattern}`)
      }

      const m = line.match(re)
      if (!m) continue

      const key = `${i + 1}:${cp.decision_number}`
      if (seen.has(key)) continue
      seen.add(key)

      conflicts.push({
        file: filePath,
        lineStart: i + 1,
        lineEnd: i + 1,
        decisionNumber: cp.decision_number,
        resolvedState: resolvedSummary(cp.decision_number, rows),
        claim: line.trim().slice(0, 140),
        suggestion: cp.suggestion ?? cp.message,
        layer: 'direct',
      })
    }
  }

  return conflicts
}
