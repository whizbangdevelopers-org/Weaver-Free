// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:decision-conflict — entry point.
 *
 * Scans planning artifacts (agents/**.md, plans/**.md) for claims that
 * contradict a resolved decision in MASTER-PLAN.md. Three detection layers:
 *
 *   Layer 1 (direct, mandatory)   — pattern match against retired/renamed
 *                                   terms used as current (Decisions #137/#136/#96).
 *   Layer 2 (structured)          — tier-gating + session-store table claims
 *                                   (Decisions #10 / #2).
 *   Layer 3 (LLM judge, gated)    — scaffold only; fail-closed; off by default.
 *
 * Amendment chains are resolved (resolve-state.ts) so claims are checked
 * against the CURRENT effective decision state, not a superseded original.
 *
 * Usage:
 *   npx tsx scripts/audit-decision-conflict.ts                 # default scan
 *   npx tsx scripts/audit-decision-conflict.ts --include-archive
 *   npx tsx scripts/audit-decision-conflict.ts <file> [<file>...]   # specific files
 *   npx tsx scripts/audit-decision-conflict.ts --json
 *
 * Exit codes: 0 = no conflicts, 1 = conflicts found (or config invalid).
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { globSync } from 'glob'
import { parseDecisionsFromFile } from './decision-conflict/parse-decisions.ts'
import { detectDirect, type ClaimPattern, type Exemption } from './decision-conflict/detect-direct.ts'
import { detectStructured, type StructuredConfig } from './decision-conflict/detect-structured.ts'
import { detectLlm } from './decision-conflict/detect-llm.ts'
import { formatReport, type Conflict, type RunSummary } from './decision-conflict/report.ts'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')
const MASTER_PLAN = resolve(PROJECT_ROOT, 'MASTER-PLAN.md')
const CONFIG_PATH = resolve(CODE_ROOT, 'scripts/data/decision-conflict-config.json')

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface DecisionConflictConfig {
  claim_patterns: ClaimPattern[]
  structured_claims: StructuredConfig
  exemptions: Exemption[]
  layers: { direct: boolean; structured: boolean; llm_judge: boolean }
  scan_paths: string[]
  exclude_paths: string[]
}

/**
 * Load + validate config. A bad config is an error, not a silent default:
 * every exemption MUST carry a non-empty justification (the config contract
 * the auditor advertises). Throws on violation.
 */
export function loadConfig(path: string = CONFIG_PATH): DecisionConflictConfig {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as DecisionConflictConfig
  if (!Array.isArray(raw.claim_patterns)) {
    throw new Error('decision-conflict-config: claim_patterns must be an array')
  }
  for (const ex of raw.exemptions ?? []) {
    if (!ex.justification || ex.justification.trim().length === 0) {
      throw new Error(
        `decision-conflict-config: exemption for ${ex.file} (decision #${ex.decision_number}) ` +
          `is missing a required justification field`,
      )
    }
  }
  return raw
}

// ---------------------------------------------------------------------------
// Core audit (exported for tests)
// ---------------------------------------------------------------------------

export interface RunAuditOptions {
  /** Explicit file list. When omitted, scan paths from config are used. */
  files?: string[]
  includeArchive?: boolean
  config?: DecisionConflictConfig
  masterPlanPath?: string
  /** Root to resolve scan globs against (defaults to PROJECT_ROOT). */
  projectRoot?: string
}

/**
 * Resolve the set of files to scan: explicit list wins; otherwise expand the
 * config scan globs minus exclude globs (archive included only with the flag).
 */
export function resolveTargets(
  config: DecisionConflictConfig,
  opts: { files?: string[]; includeArchive?: boolean; projectRoot?: string },
): string[] {
  const root = opts.projectRoot ?? PROJECT_ROOT
  if (opts.files && opts.files.length > 0) {
    // Explicit files: absolute paths pass through; relative paths resolve
    // against the caller's CWD (intuitive for CLI use), not the project root.
    return opts.files.map((f) => (f.startsWith('/') ? f : resolve(process.cwd(), f)))
  }

  const ignore = opts.includeArchive
    ? []
    : config.exclude_paths.map((p) => resolve(root, p))

  const matched = new Set<string>()
  for (const glob of config.scan_paths) {
    for (const f of globSync(resolve(root, glob), { ignore })) matched.add(f)
  }
  return [...matched].sort()
}

export function runAudit(opts: RunAuditOptions = {}): RunSummary {
  const config = opts.config ?? loadConfig()
  const rows = parseDecisionsFromFile(opts.masterPlanPath ?? MASTER_PLAN)
  const root = opts.projectRoot ?? PROJECT_ROOT
  const targets = resolveTargets(config, opts)

  const conflicts: Conflict[] = []

  for (const absPath of targets) {
    if (!existsSync(absPath)) continue
    const content = readFileSync(absPath, 'utf-8')
    const relPath = relative(root, absPath)

    if (config.layers.direct) {
      conflicts.push(
        ...detectDirect({
          filePath: relPath,
          content,
          rows,
          patterns: config.claim_patterns,
          exemptions: config.exemptions,
        }),
      )
    }
    if (config.layers.structured) {
      conflicts.push(
        ...detectStructured({
          filePath: relPath,
          content,
          rows,
          config: config.structured_claims,
        }),
      )
    }
    if (config.layers.llm_judge) {
      // Scaffold: fail-closed no-op. Ambiguous-claim collection lands with
      // the real judge implementation.
      conflicts.push(...detectLlm({ enabled: true, ambiguousClaims: [] }))
    }
  }

  return { artifactsScanned: targets.length, conflicts }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOpts {
  files: string[]
  includeArchive: boolean
  json: boolean
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = { files: [], includeArchive: false, json: false }
  for (const a of argv) {
    if (a === '--include-archive') opts.includeArchive = true
    else if (a === '--json') opts.json = true
    else if (!a.startsWith('--')) opts.files.push(a)
  }
  return opts
}

function main(): void {
  const start = Date.now()
  const cli = parseArgs(process.argv.slice(2))

  let summary: RunSummary
  try {
    summary = runAudit({ files: cli.files, includeArchive: cli.includeArchive })
  } catch (err) {
    console.error(`\x1b[31mRESULT: FAIL\x1b[0m — ${(err as Error).message}`)
    process.exit(1)
  }

  if (cli.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(formatReport(summary))
  }

  saveReport({
    reportName: 'decision-conflict',
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
    result: summary.conflicts.length === 0 ? 'pass' : 'fail',
    summary: {
      artifactsScanned: summary.artifactsScanned,
      conflicts: summary.conflicts.length,
    },
    data: { conflicts: summary.conflicts },
  })

  process.exit(summary.conflicts.length === 0 ? 0 : 1)
}

const invokedAsCli =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedAsCli) {
  main()
}
