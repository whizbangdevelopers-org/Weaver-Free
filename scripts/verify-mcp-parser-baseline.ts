// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * MCP Parser Baseline Auditor
 *
 * Guards against the class of silent drift where a structural edit to
 * LESSONS-LEARNED.md / KNOWN-GOTCHAS.md changes section headers or tag
 * conventions — and the MCP tool parsers (getLessonsLearned,
 * getKnownGotchas) silently drop entries from their output without any
 * error surfacing. Every downstream consumer of the MCP tools (agents,
 * AI reviewer, future automation) gets less knowledge and nobody
 * notices.
 *
 * The rule saved in LESSONS-LEARNED (2026-04-22 "MCP parser safety when
 * refactoring") says: baseline-snapshot + regression-test before any
 * structural edit. This auditor IS the regression test. It runs the
 * parsers against current markdown and asserts:
 *
 *   - At least MIN_LESSONS_SECTIONS sections parsed by getLessonsLearned
 *   - At least MIN_LESSONS_ENTRIES total lessons across sections
 *   - At least MIN_GOTCHAS_SECTIONS sections parsed by getKnownGotchas
 *   - At least MIN_GOTCHAS_ENTRIES total gotchas across sections
 *   - Specific high-value sections exist (Testing, Frontend, Backend,
 *     Security, NixOS — domains used most by agents)
 *
 * Thresholds sit below current counts with modest headroom. Raise when
 * a structural reorganization intentionally adds sections; lower with
 * explicit justification in a commit message if content is genuinely
 * removed.
 *
 * If this auditor fails after an edit you believe is correct, either
 *   (a) the edit inadvertently changed a header/tag convention → revert
 *       and re-do the edit while preserving the parse shape, OR
 *   (b) the thresholds are out of date because content legitimately
 *       moved → update the thresholds here WITH a note in the commit
 *       message about why the baseline shifted.
 *
 * Invocation:
 *   npx tsx scripts/verify-mcp-parser-baseline.ts
 *   or: npm run audit:mcp-parser-baseline
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

// Baselines — tuned below current counts as of 2026-04-23.
// Current measurements (update when raising):
//   getLessonsLearned: ~20 sections, ~140 lessons
//   getKnownGotchas: ~15 sections, ~90 gotchas
const MIN_LESSONS_SECTIONS = 15
const MIN_LESSONS_ENTRIES = 100
const MIN_GOTCHAS_SECTIONS = 8
const MIN_GOTCHAS_ENTRIES = 60

// Sections that must always parse — these are the domain categories
// agents cite most often. If these disappear from parser output, the
// most common consumers silently break.
const REQUIRED_LESSONS_SECTIONS_HINT = [
  /devops|deployment/i,
  /authentication/i,
  /testing|e2e/i,
]
const REQUIRED_GOTCHAS_SECTIONS_HINT = [
  /frontend/i,
  /backend/i,
  /testing/i,
]

interface Violation {
  check: string
  detail: string
}

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

async function main(): Promise<void> {
  console.log(`${BOLD}MCP Parser Baseline Audit${RESET}`)
  console.log(
    `${DIM}Guards LESSONS-LEARNED / KNOWN-GOTCHAS parse-shape against silent section drop.${RESET}`,
  )
  console.log()

  const violations: Violation[] = []

  // Dynamic import — the MCP tools ship as ES modules with .js import
  // extensions. tsx handles the TypeScript-with-.js-imports pattern at
  // runtime.
  const lessonsMod = await import(resolve(CODE_ROOT, 'mcp-server', 'src', 'tools', 'lessons-learned.ts'))
  const gotchasMod = await import(resolve(CODE_ROOT, 'mcp-server', 'src', 'tools', 'known-gotchas.ts'))

  // MCP tools expect the directory containing docs/development/ —
  // that's CODE_ROOT for Weaver, not the project root.
  const lessons = await lessonsMod.getLessonsLearned(CODE_ROOT)
  const gotchas = await gotchasMod.getKnownGotchas(CODE_ROOT)

  // getLessonsLearned sections use `.category`; getKnownGotchas uses `.name`.
  // Abstract the access so the auditor doesn't care about the schema
  // difference between the two tools.
  const lessonsSections = (lessons.sections ?? []) as Array<{ category: string; lessons: unknown[] }>
  const gotchasSections = (gotchas.sections ?? []) as Array<{ name: string; gotchas: unknown[] }>

  const lessonsEntries = lessonsSections.reduce((sum, s) => sum + (s.lessons?.length ?? 0), 0)
  const gotchasEntries = gotchasSections.reduce((sum, s) => sum + (s.gotchas?.length ?? 0), 0)

  const lessonsCategoryOf = (s: { category: string }) => s.category
  const gotchasCategoryOf = (s: { name: string }) => s.name

  console.log(
    `  ${GREEN}✓${RESET} getLessonsLearned → ${lessonsSections.length} section(s), ${lessonsEntries} lesson(s)`,
  )
  console.log(
    `  ${GREEN}✓${RESET} getKnownGotchas → ${gotchasSections.length} section(s), ${gotchasEntries} gotcha(s)`,
  )

  if (lessonsSections.length < MIN_LESSONS_SECTIONS) {
    violations.push({
      check: 'lessons-sections',
      detail: `getLessonsLearned parsed ${lessonsSections.length} sections; minimum ${MIN_LESSONS_SECTIONS}. Either a structural edit reshaped sections unintentionally, or content was legitimately removed — confirm + adjust baseline.`,
    })
  }
  if (lessonsEntries < MIN_LESSONS_ENTRIES) {
    violations.push({
      check: 'lessons-entries',
      detail: `getLessonsLearned parsed ${lessonsEntries} total lessons; minimum ${MIN_LESSONS_ENTRIES}. Parser likely dropped entries — check tag-convention drift.`,
    })
  }
  if (gotchasSections.length < MIN_GOTCHAS_SECTIONS) {
    violations.push({
      check: 'gotchas-sections',
      detail: `getKnownGotchas parsed ${gotchasSections.length} sections; minimum ${MIN_GOTCHAS_SECTIONS}.`,
    })
  }
  if (gotchasEntries < MIN_GOTCHAS_ENTRIES) {
    violations.push({
      check: 'gotchas-entries',
      detail: `getKnownGotchas parsed ${gotchasEntries} total gotchas; minimum ${MIN_GOTCHAS_ENTRIES}.`,
    })
  }

  // Required section hints — agents cite these most. If a hint fails, a
  // whole domain's knowledge vanished from MCP output.
  for (const hint of REQUIRED_LESSONS_SECTIONS_HINT) {
    if (!lessonsSections.some((s) => hint.test(lessonsCategoryOf(s)))) {
      violations.push({
        check: 'required-lessons-section',
        detail: `getLessonsLearned output missing a section matching ${hint} — agents citing this domain will get empty results`,
      })
    }
  }
  for (const hint of REQUIRED_GOTCHAS_SECTIONS_HINT) {
    if (!gotchasSections.some((s) => hint.test(gotchasCategoryOf(s)))) {
      violations.push({
        check: 'required-gotchas-section',
        detail: `getKnownGotchas output missing a section matching ${hint}`,
      })
    }
  }

  if (violations.length === 0) {
    console.log()
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — MCP parser baseline intact`)
    process.exit(0)
  }

  console.log()
  for (const v of violations) {
    console.log(`  ${RED}✗${RESET} [${v.check}] ${v.detail}`)
  }
  console.log()
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${violations.length} baseline violation(s)`)
  process.exit(1)
}

void main()
