// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * report — StaleTerm type + console formatter for audit:vocabulary-current.
 *
 * Pass output is a single line; fail output is a structured per-occurrence
 * block grouped by file (file path, line number, stale term, current term,
 * decision number, suggested replacement, context snippet). Multiple
 * occurrences in one file share a single file header.
 */

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

export interface StaleTerm {
  /** File path (relative to project root). */
  file: string
  /** 1-based line number of the stale term. */
  line: number
  /** Which rename rule fired (e.g. "premium", "plugin"). */
  renameId: string
  /** The verbatim stale term as it appears in the source (case preserved). */
  term: string
  /** Suggested current term, case-matched to the source term. */
  suggestion: string
  /** Authorizing decision number (0 = v1.1.0 internal rename). */
  decisionNumber: number
  /** Free-text authority shown when decisionNumber is 0. */
  renameAuthority?: string
  /** Surface the match was found on. */
  surface: 'prose' | 'comment' | 'template'
  /** The line text (trimmed, truncated) for context. */
  context: string
  /** Advisory note (e.g. disambiguation guidance, in-progress note). */
  note?: string
}

export interface RunSummary {
  filesScanned: number
  staleTerms: StaleTerm[]
}

/** Human-readable decision citation. */
function citation(t: StaleTerm): string {
  return t.decisionNumber > 0
    ? `Decision #${t.decisionNumber}`
    : t.renameAuthority ?? 'internal rename'
}

/** One-line pass summary. */
export function formatPass(filesScanned: number): string {
  return `audit:vocabulary-current: ${filesScanned} files scanned, 0 stale terms`
}

/** Structured per-occurrence report (fail case). Returns the full string. */
export function formatReport(summary: RunSummary): string {
  const { filesScanned, staleTerms } = summary
  if (staleTerms.length === 0) {
    return `${GREEN}${BOLD}${formatPass(filesScanned)}${RESET}`
  }

  const lines: string[] = []
  lines.push(
    `${RED}${BOLD}audit:vocabulary-current: ${staleTerms.length} stale term(s) in ${filesScanned} file(s) scanned${RESET}`,
  )
  lines.push('')

  // Group by file so multiple occurrences share a single file header.
  const byFile = new Map<string, StaleTerm[]>()
  for (const t of staleTerms) {
    const list = byFile.get(t.file) ?? []
    list.push(t)
    byFile.set(t.file, list)
  }

  for (const [file, fileTerms] of byFile) {
    lines.push(`${BOLD}${file}${RESET}`)
    for (const t of fileTerms) {
      lines.push(
        `  ${RED}✘${RESET} line ${t.line} — "${t.term}" → "${t.suggestion}" ` +
          `(${citation(t)}) ${DIM}[${t.surface}]${RESET}`,
      )
      lines.push(`      ${DIM}context:    ${t.context}${RESET}`)
      if (t.note) lines.push(`      ${DIM}note:       ${t.note}${RESET}`)
    }
    lines.push('')
  }

  lines.push(`${RED}${BOLD}RESULT: FAIL${RESET} — ${staleTerms.length} stale term(s)`)
  return lines.join('\n')
}
