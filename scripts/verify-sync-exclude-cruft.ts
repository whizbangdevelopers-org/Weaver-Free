// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Sync-Exclude Rsync Configuration Auditor
 *
 * Verifies that `sync-to-free.yml` and `release.yml` use `rsync` with
 * `--delete-excluded`. Without it, files matching `sync-exclude.yml`
 * entries that were added to the exclusion list AFTER they'd already
 * been synced to Weaver-Free stay on Weaver-Free as cruft — every user
 * rebuilding Weaver-Free from source hits UNLOADABLE_DEPENDENCY errors
 * because `routes.ts` references paths that "shouldn't exist" but do.
 *
 * This auditor is purely static: it greps the two workflow files for
 * the `--delete-excluded` flag adjacent to a rsync invocation. No
 * network, no tooling dependencies, cheap enough to run on every push.
 *
 * To fix a failure: add `--delete-excluded` to the rsync command in
 * whichever workflow lacks it. Retain `--delete` — both are required.
 * --delete removes files on destination no longer present on source;
 * --delete-excluded additionally removes files matching exclude patterns.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const WORKFLOWS_TO_CHECK = [
  resolve(PROJECT_ROOT, '.github', 'workflows', 'sync-to-free.yml'),
  resolve(PROJECT_ROOT, '.github', 'workflows', 'release.yml'),
]

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

let failures = 0

function pass(name: string, detail: string): void {
  console.log(`  ${GREEN}\u2713${RESET} ${name} ${DIM}— ${detail}${RESET}`)
}
function fail(name: string, detail: string): void {
  failures++
  console.log(`  ${RED}\u2717${RESET} ${name}`)
  console.log(`    ${DIM}${detail}${RESET}`)
}

console.log(`${BOLD}Sync-Exclude Rsync Configuration${RESET}`)
console.log(`${DIM}Ensures sync workflows use --delete-excluded so rsync cleans up files matching new exclusion patterns${RESET}`)
console.log()

for (const workflowPath of WORKFLOWS_TO_CHECK) {
  const workflowName = workflowPath.replace(PROJECT_ROOT + '/', '')
  if (!existsSync(workflowPath)) {
    fail(workflowName, 'workflow file missing')
    continue
  }

  const content = readFileSync(workflowPath, 'utf-8')
  const lines = content.split('\n')

  // Find every line that invokes rsync (i.e. has `rsync -` or ` rsync `).
  // For each, scan up to 30 lines forward for a `--delete-excluded` token
  // — covering the case where rsync flags are spread across multiple lines
  // via backslash continuation, which is how both workflows format them.
  const rsyncStarts: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*rsync\b/.test(lines[i]) || /\brsync\s+-/.test(lines[i])) {
      rsyncStarts.push(i)
    }
  }

  if (rsyncStarts.length === 0) {
    pass(workflowName, 'no rsync invocations (nothing to check)')
    continue
  }

  const missing: number[] = []
  for (const start of rsyncStarts) {
    const block = lines.slice(start, Math.min(start + 30, lines.length)).join('\n')
    // Stop scanning forward once we hit a non-continuation line that isn't
    // a flag (crude but works for the shell-continuation style used here).
    if (!/--delete-excluded\b/.test(block)) {
      missing.push(start + 1) // 1-indexed for humans
    }
  }

  if (missing.length === 0) {
    pass(workflowName, `${rsyncStarts.length} rsync invocation(s) all use --delete-excluded`)
  } else {
    fail(
      workflowName,
      `${missing.length} rsync invocation(s) missing --delete-excluded — lines ${missing.join(', ')}.\n     Fix: add '--delete-excluded' alongside '--delete' in the rsync command block.\n     Why: without it, files matching new exclusion patterns stay on the Free mirror as cruft and break rebuild-from-source.`,
    )
  }
}

console.log()
if (failures > 0) {
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${failures} workflow(s) missing --delete-excluded`)
  process.exit(1)
}
console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — sync workflows clean up excluded files on destination`)
