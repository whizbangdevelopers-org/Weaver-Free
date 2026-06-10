// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * detect-structured — Layer 2: table/section claim parser.
 *
 * Extracts claims from spec sections whose shape maps directly onto a
 * decision domain, then checks them against the resolved decision state.
 * Two parsers are implemented:
 *
 *   1. Tier Gating tables — a markdown table whose header names a feature
 *      and a tier. A row that places a known Fabrick-only capability at the
 *      `free` tier contradicts the tier split (Decision #10 / tier-matrix).
 *
 *   2. Session-store claims — prose/table text that assigns Redis (or SQLite)
 *      to the free/demo tier contradicts Decision #2 (free = in-memory).
 *
 * Layer 2 is deliberately conservative: it only fires on a structured row
 * where both the feature and the tier are unambiguous on the same line. This
 * keeps it from re-flagging the prose the direct layer already governs.
 */

import type { Conflict } from './report.ts'
import type { DecisionRow } from './parse-decisions.ts'
import { resolveDecisionState } from './resolve-state.ts'

export interface StructuredConfig {
  tier_gating?: {
    fabrick_only_features: string[]
    free_floor_features?: string[]
    message_decision: number
    message: string
  }
  session_store?: {
    decision_number: number
    free_store: string
    forbidden_for_free: string[]
    message: string
  }
}

export interface DetectStructuredOptions {
  filePath: string
  content: string
  rows: DecisionRow[]
  config: StructuredConfig
}

const DECISION_TABLE_ROW = /^\s*\| \d+ \|/

function resolvedSummary(decisionNumber: number, rows: DecisionRow[]): string {
  try {
    const r = resolveDecisionState(decisionNumber, rows, () => {})
    return `#${r.effective.number} ${r.effective.title.replace(/\s+/g, ' ').trim()}`
  } catch {
    return `#${decisionNumber}`
  }
}

export function detectStructured(opts: DetectStructuredOptions): Conflict[] {
  const { filePath, content, rows, config } = opts
  const conflicts: Conflict[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (DECISION_TABLE_ROW.test(line)) continue

    const lower = line.toLowerCase()

    // --- Tier-gating: Fabrick-only feature at free tier -------------------
    if (config.tier_gating && line.trim().startsWith('|') && lower.includes('free')) {
      for (const feature of config.tier_gating.fabrick_only_features) {
        if (lower.includes(feature.toLowerCase())) {
          // Require the row to actually ASSIGN the feature to free, not merely
          // mention "free" elsewhere. Heuristic: a markdown table cell whose
          // value for this feature is exactly/contains "free".
          // We accept the row if `free` is the tier cell adjacent to the feature.
          const cells = line.split('|').map((c) => c.trim().toLowerCase())
          const featIdx = cells.findIndex((c) => c.includes(feature.toLowerCase()))
          const assignsFree =
            featIdx >= 0 && cells.some((c, idx) => idx !== featIdx && /\bfree\b/.test(c))
          if (!assignsFree) continue

          conflicts.push({
            file: filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            decisionNumber: config.tier_gating.message_decision,
            resolvedState: resolvedSummary(config.tier_gating.message_decision, rows),
            claim: line.trim().slice(0, 140),
            suggestion: config.tier_gating.message,
            layer: 'structured',
          })
          break
        }
      }
    }

    // --- Session store: Redis/SQLite for the free tier --------------------
    if (config.session_store) {
      const ss = config.session_store
      // Require a session-storage context so we don't flag e.g. a Redis
      // *template* row that happens to share a line with "free".
      const sessionContext = /\bsession\b/.test(lower) || /\bsession[\s-]?store\b/.test(lower)
      const offending = ss.forbidden_for_free.find((s) => {
        const store = s.toLowerCase()
        if (!lower.includes(store)) return false
        // The forbidden store must be ASSIGNED TO free — i.e. tied to "free"
        // and NOT explicitly paired with a paid tier. A line like
        // "in-memory for free, Redis for Fabrick" assigns Redis to Fabrick,
        // so it must NOT flag. Detect an explicit paid-tier pairing
        // ("<store> for <paid>" / "<paid> ... <store>") and exempt it.
        const paid = '(?:fabrick|weaver|solo|team|enterprise|premium)'
        const storePairedWithPaid = new RegExp(`${store}\\s*(?:for|:|=|->|→)?\\s*${paid}|${paid}[^,]*${store}`, 'i')
        if (storePairedWithPaid.test(line)) return false
        return /\bfree\b/.test(lower)
      })
      if (offending && sessionContext) {
        conflicts.push({
          file: filePath,
          lineStart: i + 1,
          lineEnd: i + 1,
          decisionNumber: ss.decision_number,
          resolvedState: resolvedSummary(ss.decision_number, rows),
          claim: line.trim().slice(0, 140),
          suggestion: `${ss.message} Use '${ss.free_store}' for the free tier, not '${offending}'.`,
          layer: 'structured',
        })
      }
    }
  }

  return conflicts
}
