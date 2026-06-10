// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * detect-stale — Layer 1: pattern-based stale-term detection with case
 * preservation, surface classification, and historical-context filtering.
 *
 * For each line of a file, for each rename rule, the matching patterns are run.
 * A match becomes a {@link StaleTerm} citing the authorizing decision and a
 * case-matched suggestion — UNLESS one of these guards fires (do NOT flag):
 *
 *   - the line is inside a multi-line historical structure (NOTES block,
 *     decision table row, historical blockquote, inline marker span)
 *   - the line carries same-line historical phrasing ("(formerly premium)",
 *     "originally called premium", "renamed by #137")
 *   - the (file, rename) pair is exempted with a justification
 *   - for `plugin`: the line is a code-identifier surface (import/export,
 *     PluginManifest, requirePlugin, route plugin, etc.) — Decision #51 retains
 *     code-internal plugin naming; this is a PROSE-ONLY rule
 *   - for `tiers-weaver`: a code constant declaration / string literal — that
 *     surface is covered by audit:vocabulary and license-key compat keeps
 *     the string 'weaver'
 *
 * Surface classification (prose / comment / template) gates which renames apply
 * (config `surfaces`) and is reported for context.
 */

import type { Rename, VocabularyCurrentConfig } from './rename-map.ts'
import type { StaleTerm } from './report.ts'
import { buildHistoricalFilter } from './filter-historical.ts'
import { matchCase, resolvePremiumSuggestion, paragraphAt } from './resolve-context.ts'

export interface DetectOptions {
  /** Path relative to project root (used for exemption + pending-note match). */
  filePath: string
  content: string
  config: VocabularyCurrentConfig
}

/** File extension → which surfaces a line in this file can be. */
function fileKind(filePath: string): 'markdown' | 'code' {
  return /\.(md|markdown)$/i.test(filePath) ? 'markdown' : 'code'
}

/**
 * Classify the surface of a line within a code file. Markdown lines are always
 * 'prose'. Within .ts/.vue:
 *   - a line inside a comment (// , * , /* , JSDoc) → 'comment'
 *   - a Vue template string / user-facing string literal heuristic → 'template'
 *   - everything else → 'code' (not a prose surface; most renames skip it)
 */
function classifySurface(
  filePath: string,
  line: string,
): 'prose' | 'comment' | 'template' | 'code' {
  if (fileKind(filePath) === 'markdown') return 'prose'
  const t = line.trim()
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/')) {
    return 'comment'
  }
  // Vue template string / user-facing literal: a quoted or template-literal
  // string. Heuristic — good enough for "plugin" in a label.
  if (/['"`][^'"`]*\b[Pp]lugins?\b[^'"`]*['"`]/.test(line)) return 'template'
  return 'code'
}

/**
 * True when a `plugin` match on this line is a code-identifier surface that
 * Decision #51 intentionally retains (import, export, type/var name,
 * requirePlugin, PluginManifest, route plugin, etc.). Such lines are skipped.
 */
function isCodeIdentifierLine(line: string, exclusionPattern: string): boolean {
  return new RegExp(exclusionPattern).test(line)
}

/**
 * True when a `plugin` match on this line names an external-tech plugin
 * ecosystem (CoreDNS, Fastify, Capacitor, …) — out of Decision #51's scope,
 * which renamed only WEAVER'S OWN extension system. Word-boundaried, case-
 * insensitive on the qualifier.
 */
function hasExternalTechQualifier(line: string, qualifiers: string[] | undefined): boolean {
  if (!qualifiers || qualifiers.length === 0) return false
  return qualifiers.some((q) => new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(line))
}

/**
 * Compute the column ranges of inline code spans (`...`) on a line. A stale
 * term whose match index falls inside a span is a code reference, not a prose
 * label, and is not flagged. Handles paired backticks left-to-right; an unpaired
 * trailing backtick is ignored.
 */
function inlineCodeRanges(line: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  let open = -1
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '`') {
      if (open === -1) open = i
      else {
        ranges.push([open, i])
        open = -1
      }
    }
  }
  return ranges
}

function inInlineCode(col: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([a, b]) => col > a && col < b)
}

/**
 * Compute the set of 1-based line numbers that sit inside a fenced code block
 * (``` … ``` or ~~~ … ~~~). Content inside a fence is code, not prose, and is
 * never flagged. The fence delimiter lines themselves are also excluded.
 */
function fencedCodeLines(content: string): Set<number> {
  const lines = content.split('\n')
  const inside = new Set<number>()
  let fence: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trimStart()
    const m = t.match(/^(```+|~~~+)/)
    if (m) {
      if (fence === null) {
        fence = m[1]!.replace(/[^`~]/g, '')[0] === '`' ? '```' : '~~~'
        inside.add(i + 1)
        continue
      }
      // Close only on a matching fence kind.
      const kind = m[1]!.startsWith('`') ? '```' : '~~~'
      if (kind === fence) {
        inside.add(i + 1)
        fence = null
        continue
      }
    }
    if (fence !== null) inside.add(i + 1)
  }
  return inside
}

/**
 * True when a `TIERS.WEAVER`-adjacent line is a code constant declaration or a
 * 'weaver' string literal (covered by audit:vocabulary, license-key compat).
 * The bare `TIERS.WEAVER` token in prose/comments is still flagged; only the
 * constant DEFINITION and the string value 'weaver' are exempt here.
 */
function isWeaverConstantLine(line: string): boolean {
  return /WEAVER\s*[:=]/.test(line) || /['"]weaver['"]/.test(line)
}

export function detectStale(opts: DetectOptions): StaleTerm[] {
  const { filePath, content, config } = opts
  const out: StaleTerm[] = []
  const lines = content.split('\n')
  const filter = buildHistoricalFilter(content, config.historical_context)
  const fenced = fencedCodeLines(content)

  const exemptFor = (renameId: string): boolean =>
    config.exemptions.some(
      (e) =>
        e.rename_id === renameId &&
        e.justification.trim().length > 0 &&
        filePath.endsWith(e.file),
    )

  const pendingFiles = config.tiers_weaver_pending_files.files
  const isPendingTiersWeaverFile = pendingFiles.some((f) => filePath.endsWith(f))

  // Pre-compile patterns (with global+ignorecase so we can find every
  // occurrence on a line and preserve case via the captured group).
  const compiled = config.renames.map((r) => ({
    rename: r,
    regexes: r.patterns.map((p) => new RegExp(p, 'gi')),
  }))

  // One finding per (line, rename, column) — a line that uses "premium tier"
  // twice yields two, but the same single match never duplicates.
  const seen = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineNo = i + 1

    // Guard: multi-line historical structure or same-line historical phrasing.
    if (filter.historicalLines.has(lineNo)) continue
    if (filter.isHistoricalLine(line)) continue
    // Guard: fenced code block content is code, not prose.
    if (fenced.has(lineNo)) continue

    const surface = classifySurface(filePath, line)
    const codeRanges = inlineCodeRanges(line)

    for (const { rename, regexes } of compiled) {
      if (exemptFor(rename.id)) continue
      // Surface gate: the rename only applies on its configured surfaces. A
      // 'code' surface (non-comment, non-template line in a .ts/.vue) is never
      // a prose surface — skip all renames there.
      if (surface === 'code') continue
      if (!rename.surfaces.includes(surface)) continue

      // plugin: prose-only, Weaver-extension-system-only.
      if (rename.id === 'plugin') {
        // Skip code-identifier lines (requirePlugin, route plugin, plugin config…).
        if (isCodeIdentifierLine(line, config.code_identifier_exclusion)) continue
        // Skip external-tech plugin ecosystems (out of Decision #51 scope).
        if (hasExternalTechQualifier(line, rename.external_tech_qualifiers)) continue
      }
      // tiers-weaver: skip constant declarations / 'weaver' string literals.
      if (rename.id === 'tiers-weaver' && isWeaverConstantLine(line)) continue

      for (const re of regexes) {
        re.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(line)) !== null) {
          // The stale term is capture group 1 when present, else the whole
          // match. Patterns are authored so group 1 isolates the retired term.
          const term = (m[1] ?? m[0]).trim()
          // Column of the captured stale term (not the whole match), so the
          // inline-code-span test is precise even when group 1 is offset.
          const groupOffset = m[1] ? m[0].indexOf(m[1]) : 0
          const col = m.index + (groupOffset >= 0 ? groupOffset : 0)
          // Guard: a stale term inside an inline `code span` is a code
          // reference, not a prose label.
          if (inInlineCode(col, codeRanges)) {
            if (re.lastIndex === m.index) re.lastIndex++
            continue
          }
          const key = `${lineNo}:${rename.id}:${col}`
          if (seen.has(key)) {
            if (re.lastIndex === m.index) re.lastIndex++
            continue
          }
          seen.add(key)

          const { suggestion, note } = resolveSuggestion(rename, term, lines, i)
          const finding: StaleTerm = {
            file: filePath,
            line: lineNo,
            renameId: rename.id,
            term,
            suggestion,
            decisionNumber: rename.decision_number,
            surface: surface === 'prose' ? 'prose' : surface,
            context: line.trim().slice(0, 160),
          }
          if (rename.rename_authority) finding.renameAuthority = rename.rename_authority

          const notes: string[] = []
          if (note) notes.push(note)
          if (rename.id === 'tiers-weaver' && isPendingTiersWeaverFile) {
            notes.push(
              'file is in the v1.1.0 TIERS.WEAVER→TIERS.SOLO pending sweep (EXECUTION-ROADMAP §FIRST ACTION items 2/4/5/6)',
            )
          }
          if (notes.length > 0) finding.note = notes.join('; ')

          out.push(finding)

          // Avoid zero-width infinite loops.
          if (re.lastIndex === m.index) re.lastIndex++
        }
      }
    }
  }

  return out
}

/**
 * Resolve the case-matched suggestion (+ optional advisory note) for a match.
 * `premium` runs the disambiguation heuristic; every other rename uses its
 * configured `current` term, case-matched to the source term.
 */
function resolveSuggestion(
  rename: Rename,
  term: string,
  lines: string[],
  lineIndex: number,
): { suggestion: string; note?: string } {
  if (rename.id === 'premium') {
    const paragraph = paragraphAt(lines, lineIndex)
    const { suggestion, note } = resolvePremiumSuggestion({ paragraph })
    return { suggestion: matchCase(term, suggestion), note }
  }
  // Short-form mapping (e.g. EA → FM) when the matched term is the short form.
  if (rename.current_short && rename.short_term_pattern && new RegExp(rename.short_term_pattern).test(term)) {
    return { suggestion: matchCase(term, rename.current_short) }
  }
  return { suggestion: matchCase(term, rename.current) }
}
