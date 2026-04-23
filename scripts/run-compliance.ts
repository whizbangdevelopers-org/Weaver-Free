// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Compliance Suite Runner
 *
 * Orchestrates the static-compliance auditor chain. Replaces the
 * 1400-character chained `test:compliance` npm script that had become
 * unwieldy (43 auditors connected by && with no way to fail-soft,
 * reorder, or time individual checks).
 *
 * Each entry in AUDITORS runs a single npm script; failures short-circuit
 * by default (matches the old chained-`&&` behavior). Flags:
 *   --continue        run all even on failure; exit 1 at the end
 *   --json            machine-readable summary
 *   --only <name,..>  run only the named auditors
 *   --skip <name,..>  run all except the named auditors
 *   --list            print the auditor list and exit
 *
 * Adding a new auditor: add a line to AUDITORS below. One change, not
 * a manual update to a string chain.
 *
 * Invocation:
 *   npx tsx scripts/run-compliance.ts
 *   npx tsx scripts/run-compliance.ts --continue
 *   npx tsx scripts/run-compliance.ts --only vocabulary,forms
 *   or: npm run test:compliance
 *
 * Exit codes:
 *   0 — every auditor passed
 *   1 — one or more failed (details printed + summary at end)
 */

import { spawnSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')

// Registered auditors — order preserved (some depend on TUI built before
// the TUI-parity auditor runs, etc.). Add new entries here; no other file
// needs to change.
const AUDITORS: string[] = [
  'audit:vocabulary',
  'audit:forms',
  'audit:routes',
  'audit:e2e-coverage',
  'audit:e2e-selectors',
  'audit:legal',
  'audit:doc-freshness',
  'audit:tier-parity',
  'audit:tui-parity',
  'build:tui',
  'audit:cli-args',
  'audit:contrast',
  'audit:ws-codes',
  'audit:bundle',
  'audit:license',
  'audit:lockfile',
  'audit:sast',
  'audit:doc-parity',
  'audit:demo-parity',
  'audit:demo-guards',
  'audit:decision-parity',
  'audit:compliance-parity',
  'audit:compliance-matrix-parity',
  'audit:attribution',
  'audit:compatibility',
  'audit:license-parity',
  'audit:test-coverage',
  'audit:docs-links',
  'audit:nixos-version',
  'audit:project-parity',
  'audit:runbooks',
  'audit:eager-eval-tdz',
  'audit:excluded-imports',
  'audit:openssf-baseline',
  'audit:mcp-coverage',
  'audit:nix-deps-hash',
  'audit:sync-exclude-cruft',
  'audit:release-rsync-paths',
  'audit:nur-dispatch-completeness',
  'audit:engineering-discipline-parity',
  'audit:feature-lifecycle-parity',
  'audit:generated-artifact-freshness',
  'audit:agent-knowledge-coverage',
  'audit:skill-parity',
]

// build:tui is a build step embedded in the chain (historical — TUI must
// build before audit:tui-parity can inspect bundle output). Count only
// audit:* entries for the "N auditors" claim.
export function countAuditorsOnly(): number {
  return AUDITORS.filter((s) => s.startsWith('audit:')).length
}

interface Result {
  name: string
  ok: boolean
  ms: number
}

interface Opts {
  continue: boolean
  json: boolean
  only: Set<string> | null
  skip: Set<string>
  list: boolean
}

function parseArgs(argv: string[]): Opts {
  const opts: Opts = {
    continue: false,
    json: false,
    only: null,
    skip: new Set(),
    list: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--continue') opts.continue = true
    else if (a === '--json') opts.json = true
    else if (a === '--list') opts.list = true
    else if (a === '--only') opts.only = new Set((argv[++i] ?? '').split(',').filter(Boolean))
    else if (a === '--skip') (argv[++i] ?? '').split(',').filter(Boolean).forEach((x) => opts.skip.add(x))
  }
  return opts
}

function runOne(name: string): Result {
  const start = Date.now()
  // Reuse npm so each auditor gets its own declared environment/args.
  const r = spawnSync('npm', ['run', name], {
    cwd: CODE_ROOT,
    stdio: 'inherit',
  })
  return { name, ok: r.status === 0, ms: Date.now() - start }
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.list) {
    console.log(`${AUDITORS.length} entries (${countAuditorsOnly()} auditors + ${AUDITORS.length - countAuditorsOnly()} build step(s)):`)
    for (const a of AUDITORS) console.log(`  ${a}`)
    process.exit(0)
  }

  const selected = AUDITORS.filter(
    (a) => (opts.only ? opts.only.has(a) : true) && !opts.skip.has(a),
  )

  const results: Result[] = []
  const startAll = Date.now()

  for (const name of selected) {
    const r = runOne(name)
    results.push(r)
    if (!r.ok && !opts.continue) break
  }

  const totalMs = Date.now() - startAll
  const failed = results.filter((r) => !r.ok)

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          total: selected.length,
          ran: results.length,
          passed: results.length - failed.length,
          failed: failed.length,
          totalMs,
          results,
        },
        null,
        2,
      ),
    )
  } else {
    console.log()
    console.log(
      `Compliance run: ${results.length - failed.length}/${results.length} passed in ${(totalMs / 1000).toFixed(1)}s`,
    )
    if (failed.length > 0) {
      console.log(`Failed:`)
      for (const r of failed) console.log(`  ${r.name}  (${r.ms}ms)`)
    }
  }

  process.exit(failed.length === 0 ? 0 : 1)
}

main()
