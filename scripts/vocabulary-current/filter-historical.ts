// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * filter-historical — historical-context detection for audit:vocabulary-current.
 *
 * A pre-rename term is NOT a violation when it sits inside canonical historical
 * structure. This module computes, for a file, the set of line numbers that are
 * "historically contextualized" so the detector can skip them. Fail-open is the
 * design bias here (per the prompt: over-flagging is worse than under-flagging
 * because the auditor blocks compliance).
 *
 * Six historical structures are recognized:
 *   1. NOTES.md-style dated entry blocks  (## YYYY-MM-DD · Author … until next ##)
 *      — the whole block is historical; an isolated fixture may also be all-block.
 *   2. Decisions Resolved table rows      (| N | … |) — source of truth, not a claim.
 *   3. Markdown blockquotes that open with a historical marker
 *      (> Previously, > Historically, > Prior to Decision #N) — until the
 *      blockquote ends (first non-`>` line).
 *   4. Inline marker spans  <!-- historical --> … <!-- /historical -->.
 *   5. Same-line historical phrasing  ((formerly X), originally called X,
 *      renamed by #N, retired, deprecated …).
 *
 * The same-line case is handled per-line by {@link isHistoricalLine}; the
 * multi-line structures by {@link computeHistoricalLines}.
 */

import type { HistoricalContextConfig } from './rename-map.ts'

export interface HistoricalFilter {
  /** 1-based line numbers that are inside a multi-line historical structure. */
  historicalLines: Set<number>
  /** Per-line same-line-phrase test. */
  isHistoricalLine: (line: string) => boolean
}

/** Compile the same-line historical phrase patterns once. */
function compileSameLine(cfg: HistoricalContextConfig): RegExp[] {
  return cfg.same_line_phrases.map((p) => new RegExp(p, 'i'))
}

/**
 * Compute the set of 1-based line numbers covered by a MULTI-line historical
 * structure (NOTES dated blocks, decision table rows, historical blockquotes,
 * inline marker spans). Same-line phrasing is handled separately.
 */
export function computeHistoricalLines(
  content: string,
  cfg: HistoricalContextConfig,
): Set<number> {
  const lines = content.split('\n')
  const historical = new Set<number>()

  const notesHeader = new RegExp(cfg.notes_entry_header)
  const tableRow = new RegExp(cfg.decision_table_row)
  const markerOpen = new RegExp(cfg.inline_marker_open, 'i')
  const markerClose = new RegExp(cfg.inline_marker_close, 'i')
  const blockquotePrefix = new RegExp(
    `^>\\s*(?:${cfg.blockquote_prefixes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'i',
  )

  let inNotesBlock = false
  let inHistoricalQuote = false
  let inMarkerSpan = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineNo = i + 1

    // --- inline marker span (highest precedence; can wrap anything) ---
    if (markerOpen.test(line)) {
      inMarkerSpan = true
      historical.add(lineNo)
      if (markerClose.test(line)) inMarkerSpan = false
      continue
    }
    if (inMarkerSpan) {
      historical.add(lineNo)
      if (markerClose.test(line)) inMarkerSpan = false
      continue
    }

    // --- NOTES.md dated entry block: from a `## YYYY-MM-DD ·` header to the
    //     next `## ` header. Everything in between is the historical entry. ---
    if (notesHeader.test(line)) {
      inNotesBlock = true
      historical.add(lineNo)
      continue
    }
    if (inNotesBlock) {
      if (/^##\s/.test(line)) {
        // A new section header ends the dated block. If it is itself a dated
        // header the branch above re-enters; otherwise the block closes.
        inNotesBlock = notesHeader.test(line)
        if (inNotesBlock) historical.add(lineNo)
        continue
      }
      historical.add(lineNo)
      continue
    }

    // --- Decisions Resolved table row — its content IS the source of truth. ---
    if (tableRow.test(line)) {
      historical.add(lineNo)
      continue
    }

    // --- historical blockquote: opens with a historical marker, runs until
    //     the first non-blockquote line. ---
    if (blockquotePrefix.test(line)) {
      inHistoricalQuote = true
      historical.add(lineNo)
      continue
    }
    if (inHistoricalQuote) {
      if (/^>/.test(line)) {
        historical.add(lineNo)
        continue
      }
      inHistoricalQuote = false
    }
  }

  return historical
}

/** Build the per-file historical filter. */
export function buildHistoricalFilter(
  content: string,
  cfg: HistoricalContextConfig,
): HistoricalFilter {
  const historicalLines = computeHistoricalLines(content, cfg)
  const sameLine = compileSameLine(cfg)
  return {
    historicalLines,
    isHistoricalLine: (line: string) => sameLine.some((re) => re.test(line)),
  }
}
