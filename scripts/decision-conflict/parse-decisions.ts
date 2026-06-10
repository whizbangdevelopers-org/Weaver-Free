// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * parse-decisions — MASTER-PLAN.md → structured decisions[]
 *
 * Reads the "Decisions Resolved" table and turns each `| N | Title | Body |`
 * row into a {@link DecisionRow}, capturing the amendment lineage that lives
 * inside the body text.
 *
 * Amendment notation handled (case-insensitive, both forms seen in the table):
 *   - `*Amended by Decision #M*`   → amendedBy: [M]
 *   - `*Amended by #M*`            → amendedBy: [M]
 *   - `Amends Decision #M`         → amends: [M]
 *   - `Amends #M`                  → amends: [M]
 *   - `Superseded by Decision #M`  → supersededBy: [M]
 *   - `Supersedes Decision #M`     → supersedes: [M]
 *
 * The amendment edges are stored on the ORIGINAL decision (the one whose body
 * carries the annotation). `resolve-state.ts` walks them forward.
 *
 * The table parser mirrors verify-decision-parity.ts so both auditors agree on
 * what a decision row is. Kept independent (no cross-import) so this auditor
 * does not couple to another auditor's internals.
 */

import { readFileSync } from 'fs'

export interface DecisionRow {
  number: number
  title: string
  body: string
  /** Full raw markdown line (title + body cell). */
  rawLine: string
  /** 1-based line number within MASTER-PLAN.md. */
  lineNumber: number
  /** Decision numbers that amend THIS decision (declared on this row). */
  amendedBy: number[]
  /** Decision numbers this decision amends. */
  amends: number[]
  /** Decision numbers that supersede THIS decision (declared on this row). */
  supersededBy: number[]
  /** Decision numbers this decision supersedes. */
  supersedes: number[]
}

/** Extract every `#N` for a given relation phrase out of a decision body. */
function extractRefs(body: string, phrase: RegExp): number[] {
  const refs = new Set<number>()
  let m: RegExpExecArray | null
  phrase.lastIndex = 0
  while ((m = phrase.exec(body)) !== null) {
    refs.add(parseInt(m[1]!, 10))
  }
  return [...refs]
}

// Relation phrases. Both `Decision #N` and bare `#N` forms appear in the
// table (e.g. "*Amended by Decision #130*" and "*Amended by #185 ...*").
const AMENDED_BY = /Amended by(?: Decision)? #(\d+)/gi
const AMENDS = /Amends(?: Decision)? #(\d+)/gi
const SUPERSEDED_BY = /Superseded by(?: Decision)? #(\d+)/gi
const SUPERSEDES = /Supersedes(?: Decision)? #(\d+)/gi

/**
 * Parse the markdown content of MASTER-PLAN.md into decision rows.
 * Accepts the raw string so callers (and tests) can pass fixture text.
 */
export function parseDecisions(masterPlanContent: string): DecisionRow[] {
  const lines = masterPlanContent.split('\n')
  const rows: DecisionRow[] = []
  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    if (line.includes('| # | Decision | Resolution |')) {
      inTable = true
      continue
    }

    if (!inTable) continue

    // Separator line: `|---|...|`
    if (/^\|[-\s|]+\|$/.test(line.trim())) continue

    // A decision row: `| N | Title | Body |`. Title is the second cell,
    // body is everything after it (the body may itself contain `|` inside
    // inline code, so capture greedily to the trailing pipe).
    const match = line.match(/^\| (\d+) \| ([^|]*?) \| (.*) \|$/)
    if (match) {
      const number = parseInt(match[1]!, 10)
      const title = match[2]!.trim()
      const body = match[3]!.trim()
      rows.push({
        number,
        title,
        body,
        rawLine: line,
        lineNumber: i + 1,
        amendedBy: extractRefs(body, AMENDED_BY),
        amends: extractRefs(body, AMENDS),
        supersededBy: extractRefs(body, SUPERSEDED_BY),
        supersedes: extractRefs(body, SUPERSEDES),
      })
      continue
    }

    if (line.trim() === '') continue
    // Any other non-row line ends the table.
    break
  }

  return rows
}

/** Convenience: read + parse MASTER-PLAN.md from a path. */
export function parseDecisionsFromFile(masterPlanPath: string): DecisionRow[] {
  return parseDecisions(readFileSync(masterPlanPath, 'utf-8'))
}
