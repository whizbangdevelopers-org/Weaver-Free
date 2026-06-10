// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * report — Conflict type + console formatter for audit:decision-conflict.
 *
 * Pass output is a single line; fail output is a structured per-conflict
 * block (file, line range, decision number violated, current resolved state,
 * the conflicting claim text, and a suggested correction).
 */

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

export interface Conflict {
  /** File path (relative to project root). */
  file: string
  /** 1-based start line of the conflicting claim. */
  lineStart: number
  /** 1-based end line (== lineStart for single-line claims). */
  lineEnd: number
  /** The decision number the claim contradicts. */
  decisionNumber: number
  /** The current resolved state of that decision (short summary). */
  resolvedState: string
  /** The verbatim conflicting claim text. */
  claim: string
  /** A suggested correction. */
  suggestion: string
  /** Which detection layer found it. */
  layer: 'direct' | 'structured' | 'llm'
}

export interface RunSummary {
  artifactsScanned: number
  conflicts: Conflict[]
}

/** One-line pass summary. */
export function formatPass(artifactsScanned: number): string {
  return `audit:decision-conflict: ${artifactsScanned} artifacts scanned, 0 conflicts`
}

/** Structured per-conflict report (fail case). Returns the full string. */
export function formatReport(summary: RunSummary): string {
  const { artifactsScanned, conflicts } = summary
  if (conflicts.length === 0) {
    return `${GREEN}${BOLD}${formatPass(artifactsScanned)}${RESET}`
  }

  const lines: string[] = []
  lines.push(`${RED}${BOLD}audit:decision-conflict: ${conflicts.length} conflict(s) in ${artifactsScanned} artifact(s)${RESET}`)
  lines.push('')

  // Group by file for readability.
  const byFile = new Map<string, Conflict[]>()
  for (const c of conflicts) {
    const list = byFile.get(c.file) ?? []
    list.push(c)
    byFile.set(c.file, list)
  }

  for (const [file, fileConflicts] of byFile) {
    lines.push(`${BOLD}${file}${RESET}`)
    for (const c of fileConflicts) {
      const range = c.lineStart === c.lineEnd ? `${c.lineStart}` : `${c.lineStart}-${c.lineEnd}`
      lines.push(`  ${RED}✘${RESET} line ${range} — contradicts Decision #${c.decisionNumber} ${DIM}[${c.layer}]${RESET}`)
      lines.push(`      claim:      ${c.claim}`)
      lines.push(`      ${DIM}resolved:   ${c.resolvedState}${RESET}`)
      lines.push(`      ${DIM}suggestion: ${c.suggestion}${RESET}`)
    }
    lines.push('')
  }

  lines.push(`${RED}${BOLD}RESULT: FAIL${RESET} — ${conflicts.length} decision conflict(s)`)
  return lines.join('\n')
}
