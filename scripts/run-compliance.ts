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

// Registered auditors — grouped into phases. Phases run sequentially;
// auditors within a phase run in parallel. Split points honor real
// ordering constraints:
//
//   Phase 1 (prerequisites) — build:tui produces artifacts some later
//     auditors read. MUST complete before phase 2 starts.
//
//   Phase 2 (parallel-safe static auditors) — each reads files and
//     writes a report. No shared mutable state. Order within phase
//     doesn't matter.
//
//   Phase 3 (generator-adjacent) — audit:generated-artifact-freshness
//     runs generators that write to the working tree. Running alongside
//     other auditors could race on the output files if both read the
//     same artifact. Isolated to its own phase.
//
//   Phase 4 (tail) — audits that depend on phase-3 output being stable,
//     or that are themselves slow + self-contained. Run in parallel.
//
// Build steps (build:tui) live in phase 1 even though they're not
// auditors; listing them here keeps the orchestration simple.
interface Phase {
  parallel: boolean
  entries: string[]
}

export const PHASES: Phase[] = [
  // Phase 1 — prerequisites. Must complete before downstream parity checks.
  {
    parallel: false,
    entries: ['build:tui'],
  },
  // Phase 2 — bulk of static auditors. Independent reads; run parallel.
  {
    parallel: true,
    entries: [
      'audit:vocabulary',
      'audit:forms',
      'audit:routes',
      'audit:e2e-coverage',
      'audit:e2e-selectors',
      'audit:legal',
      'audit:doc-freshness',
      'audit:tier-parity',
      'audit:tui-parity',
      'audit:cli-args',
      'audit:contrast',
      'audit:ws-codes',
      'audit:bundle',
      'audit:license',
      'audit:lockfile',
      'audit:sast',
      'audit:taint',
      'audit:redos',
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
      'audit:agent-knowledge-coverage',
      'audit:skill-parity',
      'audit:mcp-parser-baseline',
      'audit:e2e-docs',
      'audit:marker-sync',
    ],
  },
  // Phase 3 — generators that write to the working tree. Isolated.
  {
    parallel: false,
    entries: ['audit:generated-artifact-freshness'],
  },
]

// Flat view for --list and older call sites.
const AUDITORS: string[] = PHASES.flatMap((p) => p.entries)

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

// Run a list of auditors in parallel using async spawn. Returns once all
// complete; does NOT short-circuit within a phase (all parallel auditors
// run to completion even if one fails — matches the useful "see all the
// broken things at once" property of test suites). Between phases,
// we still honor --continue for the overall sequential flow.
async function runParallel(names: string[]): Promise<Result[]> {
  const { spawn } = await import('child_process')
  const tasks = names.map(
    (name) =>
      new Promise<Result>((resolveTask) => {
        const start = Date.now()
        // Serialize stdout/stderr per-auditor so parallel output doesn't
        // interleave unreadably. Each auditor's output prints as a block
        // after it completes.
        const chunks: Buffer[] = []
        const child = spawn('npm', ['run', name], {
          cwd: CODE_ROOT,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        child.stdout?.on('data', (d: Buffer) => chunks.push(d))
        child.stderr?.on('data', (d: Buffer) => chunks.push(d))
        child.on('close', (code: number | null) => {
          const header = `\n\x1b[2m──── ${name} (${Date.now() - start}ms) ────\x1b[0m\n`
          process.stdout.write(header + Buffer.concat(chunks).toString('utf8'))
          resolveTask({ name, ok: code === 0, ms: Date.now() - start })
        })
      }),
  )
  return Promise.all(tasks)
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.list) {
    console.log(`${AUDITORS.length} entries (${countAuditorsOnly()} auditors + ${AUDITORS.length - countAuditorsOnly()} build step(s)):`)
    for (const phase of PHASES) {
      console.log(`\n  ${phase.parallel ? 'parallel' : 'sequential'}:`)
      for (const a of phase.entries) console.log(`    ${a}`)
    }
    process.exit(0)
  }

  const isSelected = (name: string) =>
    (opts.only ? opts.only.has(name) : true) && !opts.skip.has(name)

  const results: Result[] = []
  const startAll = Date.now()

  outer: for (const phase of PHASES) {
    const entries = phase.entries.filter(isSelected)
    if (entries.length === 0) continue

    if (phase.parallel && entries.length > 1) {
      const phaseResults = await runParallel(entries)
      results.push(...phaseResults)
      if (phaseResults.some((r) => !r.ok) && !opts.continue) break outer
    } else {
      for (const name of entries) {
        const r = runOne(name)
        results.push(r)
        if (!r.ok && !opts.continue) break outer
      }
    }
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

// Only run when invoked as CLI. Prevents side effects (notably
// triggering build:tui) when this module is imported for its PHASES
// export from sync-markers and similar tooling.
const invokedAsCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedAsCli) {
  void main()
}
