// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'

interface VocabularyTerm {
  term: string
  definition: string
}

interface GlobalVocabularyResult {
  /** Parsed vocabulary table from ## Vocabulary section */
  vocabulary: VocabularyTerm[]
  /** Engineering principles section verbatim */
  engineeringPrinciples: string
  /** Decision-making style section verbatim */
  decisionMakingStyle: string
  /** Operational preferences section verbatim */
  operationalPreferences: string
  /** Forge infrastructure section verbatim */
  forgeInfrastructure: string
  /** Full raw content — use when a specific section isn't sufficient */
  raw: string
  /** Path that was read */
  sourcePath: string
  warnings: string[]
}

function extractSection(content: string, heading: string): string {
  const pattern = new RegExp(`^##\\s+${heading}\\s*$`, 'm')
  const start = content.search(pattern)
  if (start === -1) return ''
  const afterHeading = content.indexOf('\n', start) + 1
  // Find the next ## heading
  const nextHeading = content.slice(afterHeading).search(/^##\s+/m)
  if (nextHeading === -1) return content.slice(afterHeading).trim()
  return content.slice(afterHeading, afterHeading + nextHeading).trim()
}

function parseVocabularyTable(section: string): VocabularyTerm[] {
  const terms: VocabularyTerm[] = []
  for (const line of section.split('\n')) {
    // Match markdown table rows: | **Term** | definition |
    const match = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|/)
    if (match) {
      terms.push({ term: match[1].trim(), definition: match[2].trim() })
    }
  }
  return terms
}

/**
 * Read ~/.claude/CLAUDE.md and return the global vocabulary, engineering
 * principles, decision-making style, and other cross-project behavioral rules.
 *
 * This is the source of truth for terms like Forge vs Foundry, WBD vocabulary,
 * and engineering principles that apply across all projects but are not loaded
 * automatically by Claude Desktop (only Claude Code CLI loads it on session start).
 */
export async function getGlobalVocabulary(): Promise<GlobalVocabularyResult> {
  const warnings: string[] = []
  const sourcePath = resolve(homedir(), '.claude', 'CLAUDE.md')

  const raw = await safeReadFile(sourcePath)
  if (!raw) {
    warnings.push(`Could not read ${sourcePath}`)
    return {
      vocabulary: [],
      engineeringPrinciples: '',
      decisionMakingStyle: '',
      operationalPreferences: '',
      forgeInfrastructure: '',
      raw: '',
      sourcePath,
      warnings,
    }
  }

  const vocabulary = parseVocabularyTable(extractSection(raw, 'Vocabulary'))
  const engineeringPrinciples = extractSection(raw, 'Engineering Principles')
  const decisionMakingStyle = extractSection(raw, 'Decision-Making Style')
  const operationalPreferences = extractSection(raw, 'Operational Preferences')
  const forgeInfrastructure = extractSection(raw, 'Forge Infrastructure')

  return {
    vocabulary,
    engineeringPrinciples,
    decisionMakingStyle,
    operationalPreferences,
    forgeInfrastructure,
    raw,
    sourcePath,
    warnings,
  }
}
