// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Harness Tier-Parity Auditor (audit:harness-tier-parity)
 *
 * Guards the harness's tier-boundary projection against drift from its
 * source of truth. `test-infra/harness/tier-capabilities.generated.json`
 * is GENERATED from `code/tier-matrix.json` by gen-tier-capabilities.ts.
 * If someone edits the matrix (or the generator) and bypasses the
 * pre-commit hook, the committed projection drifts — and the harness's
 * runtime tier-unlock / tier-refusal assertions would test stale
 * boundaries. This auditor catches that class at push time.
 *
 * Pattern (mirrors verify-generated-artifact-freshness.ts):
 *   1. Snapshot the committed projection.
 *   2. Run the generator (it writes the projection to disk).
 *   3. Diff the new content against the snapshot.
 *   4. If different → FAIL with a remediation message. The working tree
 *      already holds the fresh projection, so `git add <path>` fixes it.
 *
 * Leaving the working tree regenerated is acceptable for the same reasons
 * as the freshness auditor: CI trees are ephemeral, regenerating locally
 * is always safe (it's what the pre-commit hook does), and the failure
 * message points at the fix.
 *
 * Invocation:
 *   npx tsx scripts/verify-harness-tier-parity.ts
 *   or: npm run audit:harness-tier-parity
 *
 * Exit codes:
 *   0 — projection matches the generator's current output
 *   1 — projection is stale (details + remediation printed)
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const ARTIFACT = resolve(PROJECT_ROOT, 'test-infra', 'harness', 'tier-capabilities.generated.json')
const ARTIFACT_REL = 'test-infra/harness/tier-capabilities.generated.json'
const SOURCE_REL = 'code/tier-matrix.json'
const GENERATOR = ['npx', 'tsx', 'scripts/gen-tier-capabilities.ts']

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function snapshot(): string {
  return existsSync(ARTIFACT) ? readFileSync(ARTIFACT, 'utf8') : ''
}

function runGenerator(): string | null {
  try {
    execFileSync(GENERATOR[0]!, GENERATOR.slice(1), {
      cwd: CODE_ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    })
    return null
  } catch (e) {
    return (e as Error).message
  }
}

function diffSummary(before: string, after: string): string {
  if (before === '') return 'projection did not exist before generator ran'
  const beforeLines = before.split('\n').length
  const afterLines = after.split('\n').length
  const a = before.split('\n')
  const b = after.split('\n')
  let firstDiff: number | null = null
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      firstDiff = i + 1
      break
    }
  }
  return `${beforeLines} → ${afterLines} lines; first diff at line ${firstDiff ?? '?'}`
}

function main(): void {
  console.log(`${BOLD}Harness Tier-Parity Audit${RESET}`)
  console.log(
    `${DIM}Regenerates ${ARTIFACT_REL} from ${SOURCE_REL}; diffs against committed copy.${RESET}`,
  )
  console.log(
    `${DIM}Catches the "harness tier projection drifted from tier-matrix.json" class at push time.${RESET}`,
  )
  console.log()

  const before = snapshot()

  const err = runGenerator()
  if (err) {
    console.log(`  ${RED}✗${RESET} generator failed: gen-tier-capabilities.ts`)
    console.log(`    ${DIM}${err}${RESET}`)
    console.log()
    console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — generator did not run cleanly`)
    process.exit(1)
  }

  const after = snapshot()

  if (before === after) {
    console.log(
      `  ${GREEN}✓${RESET} ${ARTIFACT_REL} matches generator output (source: ${SOURCE_REL})`,
    )
    console.log()
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — harness tier projection is fresh`)
    process.exit(0)
  }

  console.log(`  ${RED}✗${RESET} ${ARTIFACT_REL} is stale`)
  console.log(`    ${DIM}${diffSummary(before, after)}${RESET}`)
  console.log()
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — harness tier projection drifted from ${SOURCE_REL}`)
  console.log()
  console.log(
    `Remediation: the projection has already been regenerated in your working tree.`,
  )
  console.log(
    `             Stage the fresh version and re-commit: ${BOLD}git add ${ARTIFACT_REL}${RESET}`,
  )
  console.log(
    `             (The pre-commit hook regenerates this automatically when ${SOURCE_REL}`,
  )
  console.log(`             or the generator is staged — check why it was bypassed.)`)
  process.exit(1)
}

main()
