// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-cli-args.ts — CLI arg passthrough smoke test.
 *
 * Verifies that CLI flags actually reach the runtime when invoked
 * through npm scripts. Catches silent arg swallowing from double-nested
 * npm run, broken shell expansion, or missing -- separators.
 *
 * Background: npm run nesting silently eats -- args (no error, no warning).
 * See LESSONS-LEARNED.md "Double-Nested npm run Silently Swallows CLI Args".
 *
 * Usage:  npx tsx scripts/verify-cli-args.ts
 * Exit:   0 = all flags reach runtime, 1 = arg passthrough broken
 */

import { execSync } from 'child_process'
import { resolve } from 'path'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const ROOT = resolve(import.meta.dirname, '..')

interface CliTest {
  /** Human-readable label */
  label: string
  /** Command to run (cwd = repo root) */
  command: string
  /** String that must appear in stdout for the test to pass */
  expectStdout?: string
  /** If true, check stderr instead of stdout */
  checkStderr?: boolean
  /** Expected exit code (default: 0) */
  exitCode?: number
  /** Timeout in ms (default: 15000) */
  timeout?: number
}

const tests: CliTest[] = [
  // TUI: --help reaches the binary
  {
    label: 'TUI --help via direct node',
    command: 'node tui/dist/index.js --help',
    expectStdout: 'Demo mode',
  },
  // TUI: --demo --export produces valid JSON through npm run
  {
    label: 'TUI --demo --export via npm run start:tui',
    command: 'npm run start:tui -- --demo --export 2>/dev/null',
    expectStdout: '"name"',
  },
  // TUI: --demo --tier free --export respects tier flag
  {
    label: 'TUI --demo --tier free --export via npm run start:tui',
    command: 'npm run start:tui -- --demo --tier free --export 2>/dev/null',
    expectStdout: '"name"',
  },
  // Backend: --help reaches the binary (if applicable)
  // Build scripts: no arg passthrough needed (covered by convention rule)
]

let passed = 0
let failed = 0
const failures: string[] = []

console.log(`${BOLD}CLI Arg Passthrough Smoke Tests${RESET}\n`)

for (const test of tests) {
  const timeout = test.timeout ?? 15_000
  const expectedExit = test.exitCode ?? 0
  const label = test.label

  try {
    const result = execSync(test.command, {
      cwd: ROOT,
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const output = test.checkStderr ? '' : result
    if (test.expectStdout && !output.includes(test.expectStdout)) {
      failed++
      const msg = `${RED}FAIL${RESET} ${label}\n` +
        `  ${DIM}Expected stdout to contain: "${test.expectStdout}"${RESET}\n` +
        `  ${DIM}Got: ${output.slice(0, 200)}${RESET}`
      console.log(msg)
      failures.push(label)
    } else {
      passed++
      console.log(`${GREEN}PASS${RESET} ${label}`)
    }
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string; message?: string }

    if (e.status === expectedExit && expectedExit !== 0) {
      // Non-zero exit was expected
      const output = test.checkStderr ? (e.stderr ?? '') : (e.stdout ?? '')
      if (test.expectStdout && !output.includes(test.expectStdout)) {
        failed++
        console.log(`${RED}FAIL${RESET} ${label} — expected output not found`)
        failures.push(label)
      } else {
        passed++
        console.log(`${GREEN}PASS${RESET} ${label}`)
      }
    } else {
      failed++
      const msg = `${RED}FAIL${RESET} ${label}\n` +
        `  ${DIM}${e.message ?? 'Unknown error'}${RESET}`
      console.log(msg)
      failures.push(label)
    }
  }
}

console.log(`\n${BOLD}Results:${RESET} ${passed} passed, ${failed} failed`)

if (failures.length > 0) {
  console.log(`\n${RED}Failures:${RESET}`)
  failures.forEach(f => console.log(`  - ${f}`))
  console.log(`\n${DIM}This likely means an npm script is swallowing CLI args.`)
  console.log(`Check that user-facing scripts (start:*, dev:*) invoke the binary directly,`)
  console.log(`not through nested npm --prefix ... run. See .claude/rules/scripts.md.${RESET}`)
  process.exit(1)
}
