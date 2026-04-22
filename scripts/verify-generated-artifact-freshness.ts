// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Generated-Artifact Freshness Auditor
 *
 * Prevents the "committed artifact drifted from its source" class of gap.
 * Several docs + files in the repo are GENERATED from a source of truth:
 *
 *   Source                                      → Generator              → Artifact
 *   ───────────────────────────────────────────────────────────────────────────────
 *   business/investor/PITCH-DECK.md             → sync-deck.mjs          → business/investor/deck/index.html
 *   plans/cross-version/FEATURE-LIFECYCLES.md   → generate-feature-      → business/sales/partners/ROADMAP.md
 *                                                  lifecycle-views.ts    → business/investor/LIFECYCLE-REVENUE-TIMELINE.md
 *   forge/DELIVERY.json                         → generate:versions     → code/src/config/delivery-versions.ts
 *
 * Pre-commit hooks regenerate these when the source is edited. If someone
 * edits the source and bypasses the hook (or edits the generator without
 * touching the source), the committed artifact drifts. This auditor catches
 * that class at push time.
 *
 * Pattern for each generator:
 *   1. Snapshot the committed artifact content
 *   2. Run the generator (it writes to disk)
 *   3. Diff the new content against the snapshot
 *   4. If different, the commit needs the regenerated artifact too — FAIL
 *      with a remediation message. The working tree already has the fresh
 *      content, so `git add <artifact>` + re-commit fixes it.
 *
 * The auditor leaves the working tree "regenerated" — acceptable because:
 *   (a) in CI the working tree is ephemeral
 *   (b) locally, running the generator is always safe (it's what the
 *       pre-commit hook would have done)
 *   (c) the failure message points at `git add` to pick up the fresh
 *       artifact
 *
 * When to add a new entry to GENERATORS below:
 *   - Any time you add a script that writes to a committed file
 *   - Any time a sync-style hook is added to pre-commit
 *   - Any time a dist/ or generated/ artifact appears in the repo
 *
 * Invocation:
 *   npx tsx scripts/verify-generated-artifact-freshness.ts
 *   or: npm run audit:generated-artifact-freshness
 *
 * Exit codes:
 *   0 — every artifact matches its generator's current output
 *   1 — one or more artifacts are stale (details + remediation printed)
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

interface Generator {
  name: string
  // Command executed to regenerate. Array form for execFileSync (no shell).
  command: string[]
  // CWD relative to PROJECT_ROOT where the command runs.
  cwd: string
  // Artifact paths (relative to PROJECT_ROOT) the generator writes.
  // These are what we snapshot + diff.
  artifacts: string[]
  // Human-readable hint about the source file(s) that drive this generator.
  sources: string[]
}

// Registry — one entry per committed-artifact pipeline.
// ADD ENTRIES HERE when a new generator ships.
const GENERATORS: Generator[] = [
  {
    name: 'pitch-deck HTML (sync-deck.mjs)',
    command: ['node', 'business/investor/deck/sync-deck.mjs'],
    cwd: '.',
    artifacts: ['business/investor/deck/index.html'],
    sources: ['business/investor/PITCH-DECK.md'],
  },
  {
    name: 'feature-lifecycle views (generate-feature-lifecycle-views.ts)',
    command: ['npx', 'tsx', 'scripts/generate-feature-lifecycle-views.ts'],
    cwd: 'code',
    artifacts: [
      'business/sales/partners/ROADMAP.md',
      'business/investor/LIFECYCLE-REVENUE-TIMELINE.md',
    ],
    sources: [
      'plans/cross-version/FEATURE-LIFECYCLES.md',
      'code/scripts/generate-feature-lifecycle-views.ts',
    ],
  },
  {
    name: 'delivery versions (generate-versions.sh)',
    command: ['npm', 'run', 'generate:versions'],
    cwd: 'code',
    artifacts: ['code/src/config/delivery-versions.ts'],
    sources: ['forge/DELIVERY.json'],
  },
]

interface Violation {
  generator: string
  artifact: string
  diffSummary: string
}

function snapshot(path: string): string {
  const abs = resolve(PROJECT_ROOT, path)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : ''
}

function runGenerator(g: Generator): string | null {
  try {
    execFileSync(g.command[0]!, g.command.slice(1), {
      cwd: resolve(PROJECT_ROOT, g.cwd),
      stdio: 'pipe',
      encoding: 'utf8',
    })
    return null
  } catch (e) {
    return (e as Error).message
  }
}

function diffSummary(before: string, after: string): string {
  if (before === after) return ''
  if (before === '') return 'artifact did not exist before generator ran'
  const beforeLines = before.split('\n').length
  const afterLines = after.split('\n').length
  const firstDiff = (() => {
    const a = before.split('\n')
    const b = after.split('\n')
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) return i + 1
    }
    return null
  })()
  return `${beforeLines} → ${afterLines} lines; first diff at line ${firstDiff ?? '?'}`
}

function audit(): Violation[] {
  const violations: Violation[] = []

  for (const g of GENERATORS) {
    // Snapshot each artifact before running the generator.
    const before = new Map<string, string>()
    for (const a of g.artifacts) {
      before.set(a, snapshot(a))
    }

    const err = runGenerator(g)
    if (err) {
      violations.push({
        generator: g.name,
        artifact: '(generator failed)',
        diffSummary: err,
      })
      continue
    }

    for (const a of g.artifacts) {
      const after = snapshot(a)
      if (before.get(a) !== after) {
        violations.push({
          generator: g.name,
          artifact: a,
          diffSummary: diffSummary(before.get(a) ?? '', after),
        })
      }
    }
  }

  return violations
}

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function main(): void {
  console.log(`${BOLD}Generated-Artifact Freshness Audit${RESET}`)
  console.log(
    `${DIM}Runs every registered generator; diffs committed artifacts vs output.${RESET}`,
  )
  console.log(
    `${DIM}Catches the "committed artifact drifted from its source" class at push time.${RESET}`,
  )
  console.log()

  const violations = audit()

  if (violations.length === 0) {
    for (const g of GENERATORS) {
      console.log(
        `  ${GREEN}✓${RESET} ${g.name} — ${g.artifacts.length} artifact(s) match generator output`,
      )
    }
    console.log()
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — all generated artifacts are fresh`)
    process.exit(0)
  }

  for (const v of violations) {
    console.log(`  ${RED}✗${RESET} ${v.generator}: ${v.artifact}`)
    console.log(`    ${DIM}${v.diffSummary}${RESET}`)
  }
  console.log()
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${violations.length} stale artifact(s)`)
  console.log()
  console.log(
    'Remediation: each stale artifact has already been regenerated in your working tree.',
  )
  console.log(
    `             Stage the fresh versions and re-commit: ${BOLD}git add <paths>${RESET} && git commit --amend`,
  )
  console.log(
    '             (Or if this is a clean working tree and you just ran the auditor,',
  )
  console.log(
    '             the pre-commit hook should have caught this earlier — check if',
  )
  console.log(
    '             the hook trigger paths include the source file you edited.)',
  )
  process.exit(1)
}

main()
