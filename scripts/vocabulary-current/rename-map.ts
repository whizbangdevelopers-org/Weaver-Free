// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * rename-map — authoritative pre-rename → current vocabulary mapping.
 *
 * Sourced from scripts/data/vocabulary-current-config.json so the mapping is
 * reviewable as DATA (per .claude/rules/single-source-generated.md), not baked
 * into code. Each {@link Rename} encodes one retired term, the decision that
 * authorized its rename, the current term (+ optional fallback), the surfaces
 * the term should be flagged on, and the narrow detection patterns.
 *
 * Calibration discipline (never-game-auditors): patterns flag a term ONLY when
 * it reads as a current tier/program/nav label, not as an adjectival descriptor.
 * The config _comment documents this contract for future maintainers.
 */

import { readFileSync } from 'fs'

export type Surface = 'prose' | 'comment' | 'template'

export interface Rename {
  id: string
  /** Authorizing decision; 0 for the v1.1.0 internal TIERS.WEAVER rename. */
  decision_number: number
  /** Free-text authority when decision_number is 0 (internal rename). */
  rename_authority?: string
  /** Current canonical term. */
  current: string
  /** Optional fallback term when context is ambiguous. */
  current_fallback?: string
  /** Optional short-form current term (e.g. EA→FM as well as Early Adopter→Founding Member). */
  current_short?: string
  /** Regex (matched against the captured term) selecting when current_short applies. */
  short_term_pattern?: string
  /** Surfaces this rename applies to. */
  surfaces: Surface[]
  /** Maintainer-facing note (calibration rationale). */
  note?: string
  /** Detection regex sources. Each must capture the stale term in group 1
   *  (or have a single literal alternation) for case preservation. */
  patterns: string[]
  /** For the `plugin` rename only: external-tech vendor names whose own
   *  "plugin" terminology is out of Decision #51's scope. A line naming any of
   *  these is not flagged (CoreDNS/Fastify/Capacitor plugins etc.). */
  external_tech_qualifiers?: string[]
}

export interface HistoricalContextConfig {
  same_line_phrases: string[]
  blockquote_prefixes: string[]
  inline_marker_open: string
  inline_marker_close: string
  notes_entry_header: string
  decision_table_row: string
}

export interface Exemption {
  file: string
  rename_id: string
  justification: string
}

export interface TiersWeaverPending {
  files: string[]
}

export interface VocabularyCurrentConfig {
  renames: Rename[]
  historical_context: HistoricalContextConfig
  code_identifier_exclusion: string
  tiers_weaver_pending_files: TiersWeaverPending
  exemptions: Exemption[]
  scan_paths: string[]
  exclude_paths: string[]
}

/**
 * Load + validate config. A bad config is an error, not a silent default:
 *   - renames must be a non-empty array
 *   - every rename must carry at least one pattern + a current term
 *   - every exemption MUST carry a non-empty justification (the contract this
 *     auditor advertises — same discipline as audit:decision-conflict)
 * Throws on violation.
 */
export function loadConfig(path: string): VocabularyCurrentConfig {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as VocabularyCurrentConfig

  if (!Array.isArray(raw.renames) || raw.renames.length === 0) {
    throw new Error('vocabulary-current-config: renames must be a non-empty array')
  }
  for (const r of raw.renames) {
    if (!r.id || !r.current) {
      throw new Error(`vocabulary-current-config: rename "${r.id ?? '?'}" is missing id or current term`)
    }
    if (!Array.isArray(r.patterns) || r.patterns.length === 0) {
      throw new Error(`vocabulary-current-config: rename "${r.id}" has no patterns`)
    }
    // Fail fast on a malformed regex — a silent skip would hide drift.
    for (const p of r.patterns) {
      try {
        // eslint-disable-next-line no-new -- compile-only validation of the config pattern
        new RegExp(p)
      } catch {
        throw new Error(`vocabulary-current-config: rename "${r.id}" has an invalid regex: ${p}`)
      }
    }
  }
  for (const ex of raw.exemptions ?? []) {
    if (!ex.justification || ex.justification.trim().length === 0) {
      throw new Error(
        `vocabulary-current-config: exemption for ${ex.file} (rename "${ex.rename_id}") ` +
          `is missing a required justification field`,
      )
    }
  }
  return raw
}
