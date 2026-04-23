// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * MCP Parser Baseline Refresh
 *
 * Measures current getLessonsLearned / getKnownGotchas output and writes
 * new thresholds into scripts/baselines/mcp-parser.json. The resulting
 * diff must be human-reviewed and committed with a message that explains
 * why the baseline moved (e.g., "legitimate section reorganization",
 * "intentional content growth").
 *
 * Per never-game-auditors: this script does not silence the auditor —
 * it refreshes the baseline so the auditor continues to catch real drift
 * against a current-accurate reference. The bump is transparent in git.
 *
 * Buffer policy:
 *   - Lessons: current − 5% (small reorganization allowance on high-volume content)
 *   - Gotchas sections: current − 1 (tolerates one section merge before next refresh)
 *   - Gotchas entries: current − 10% (larger relative allowance; content is lower-volume)
 *
 * Invocation:
 *   npm run baseline:mcp-parser:refresh
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')

const baselinePath = resolve(__dirname, 'baselines', 'mcp-parser.json')

async function main(): Promise<void> {
  console.log('Measuring current MCP parser output…')

  const lessonsMod = await import(resolve(CODE_ROOT, 'mcp-server', 'src', 'tools', 'lessons-learned.ts'))
  const gotchasMod = await import(resolve(CODE_ROOT, 'mcp-server', 'src', 'tools', 'known-gotchas.ts'))

  const lessons = await lessonsMod.getLessonsLearned(CODE_ROOT)
  const gotchas = await gotchasMod.getKnownGotchas(CODE_ROOT)

  const lessonsSections = (lessons.sections ?? []) as Array<{ lessons: unknown[] }>
  const gotchasSections = (gotchas.sections ?? []) as Array<{ gotchas: unknown[] }>

  const lessonsSectionsCount = lessonsSections.length
  const lessonsEntriesCount = lessonsSections.reduce((sum, s) => sum + (s.lessons?.length ?? 0), 0)
  const gotchasSectionsCount = gotchasSections.length
  const gotchasEntriesCount = gotchasSections.reduce((sum, s) => sum + (s.gotchas?.length ?? 0), 0)

  console.log(`  lessons: ${lessonsSectionsCount} sections, ${lessonsEntriesCount} entries`)
  console.log(`  gotchas: ${gotchasSectionsCount} sections, ${gotchasEntriesCount} entries`)

  // Apply buffer policy.
  const minLessonsSections = Math.floor(lessonsSectionsCount * 0.95)
  const minLessonsEntries = Math.floor(lessonsEntriesCount * 0.95)
  const minGotchasSections = Math.max(gotchasSectionsCount - 1, 1)
  const minGotchasEntries = Math.floor(gotchasEntriesCount * 0.9)

  const today = new Date().toISOString().slice(0, 10)

  const existing = JSON.parse(readFileSync(baselinePath, 'utf8'))
  const refreshed = {
    ...existing,
    _lastRefreshed: today,
    _currentMeasurements: {
      lessonsSections: lessonsSectionsCount,
      lessonsEntries: lessonsEntriesCount,
      gotchasSections: gotchasSectionsCount,
      gotchasEntries: gotchasEntriesCount,
    },
    thresholds: {
      minLessonsSections,
      minLessonsEntries,
      minGotchasSections,
      minGotchasEntries,
    },
  }

  writeFileSync(baselinePath, JSON.stringify(refreshed, null, 2) + '\n')

  console.log()
  console.log(`Wrote new thresholds to ${baselinePath}:`)
  console.log(`  minLessonsSections: ${minLessonsSections} (from ${existing.thresholds.minLessonsSections})`)
  console.log(`  minLessonsEntries:  ${minLessonsEntries} (from ${existing.thresholds.minLessonsEntries})`)
  console.log(`  minGotchasSections: ${minGotchasSections} (from ${existing.thresholds.minGotchasSections})`)
  console.log(`  minGotchasEntries:  ${minGotchasEntries} (from ${existing.thresholds.minGotchasEntries})`)
  console.log()
  console.log('Review the diff, then commit with a message explaining why the baseline moved.')
}

void main()
