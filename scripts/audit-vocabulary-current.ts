// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:vocabulary-current — entry point.
 *
 * Flags PRE-RENAME terms used as if they were CURRENT vocabulary in PROSE
 * (planning artifacts, code comments, Vue templates, docs). Companion to:
 *
 *   - audit:vocabulary (verify-vocabulary-sync.ts) — the CONSTANT side
 *     (vocabularies.ts triplication, tier/role/status literals in src/backend/tui).
 *     This auditor does NOT touch constants — prose-side only.
 *   - audit:decision-conflict — SEMANTIC contradictions with resolved decisions.
 *     This auditor catches VOCABULARY drift (the WORD used as current), not
 *     policy contradictions. On the same file the two cite different things.
 *
 * Five rename rules (config-sourced): premium→Weaver Solo/Weaver (#137),
 * enterprise→Fabrick (#137), Early Adopter/EA→Founding Member/FM (#136),
 * TIERS.WEAVER→TIERS.SOLO (v1.1.0 internal rename), plugin→Integrated
 * Extension/extension (#51, prose-only).
 *
 * It does NOT walk the decision amendment chain — it checks current vocabulary,
 * not decision lineage (that is decision-conflict's job).
 *
 * Usage:
 *   npx tsx scripts/audit-vocabulary-current.ts                 # default scan
 *   npx tsx scripts/audit-vocabulary-current.ts --include-archive
 *   npx tsx scripts/audit-vocabulary-current.ts <file> [<file>...]
 *   npx tsx scripts/audit-vocabulary-current.ts --json
 *
 * Exit codes: 0 = no stale terms, 1 = stale terms found (or config invalid).
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { globSync } from 'glob'
import { loadConfig, type VocabularyCurrentConfig } from './vocabulary-current/rename-map.ts'
import { detectStale } from './vocabulary-current/detect-stale.ts'
import { formatReport, type StaleTerm, type RunSummary } from './vocabulary-current/report.ts'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')
const CONFIG_PATH = resolve(CODE_ROOT, 'scripts/data/vocabulary-current-config.json')

export { loadConfig }
export type { VocabularyCurrentConfig }

// ---------------------------------------------------------------------------
// Target resolution
// ---------------------------------------------------------------------------

export interface RunAuditOptions {
  /** Explicit file list. When omitted, scan paths from config are used. */
  files?: string[]
  includeArchive?: boolean
  config?: VocabularyCurrentConfig
  /** Root to resolve scan globs against (defaults to PROJECT_ROOT). */
  projectRoot?: string
}

/**
 * Resolve the set of files to scan: explicit list wins; otherwise expand the
 * config scan globs minus exclude globs (archive included only with the flag).
 *
 * Scan paths are project-root-relative (the corpus lives above code/). Some
 * globs are bare filenames (README.md, CONTRIBUTING.md) — those resolve at
 * project root too.
 */
export function resolveTargets(
  config: VocabularyCurrentConfig,
  opts: { files?: string[]; includeArchive?: boolean; projectRoot?: string },
): string[] {
  const root = opts.projectRoot ?? PROJECT_ROOT
  if (opts.files && opts.files.length > 0) {
    return opts.files.map((f) => (f.startsWith('/') ? f : resolve(process.cwd(), f)))
  }

  // The archive exclusions are dropped with --include-archive, but the
  // self-referential / historical-structure exclusions (PROMPT files,
  // docs/knowledge, NOTES.md, LESSONS-LEARNED) ALWAYS apply — they are never
  // legitimate subjects of this audit even in archive mode.
  const alwaysExclude = config.exclude_paths.filter(
    (p) =>
      !p.includes('archive') ||
      p.includes('PROMPT') ||
      p.includes('knowledge') ||
      p.includes('NOTES') ||
      p.includes('LESSONS') ||
      p.includes('KNOWN-GOTCHAS') ||
      p.includes('CHANGELOG'),
  )
  const exclude = opts.includeArchive ? alwaysExclude : config.exclude_paths
  const ignore = exclude.map((p) => resolve(root, p))

  const matched = new Set<string>()
  for (const glob of config.scan_paths) {
    for (const f of globSync(resolve(root, glob), { ignore })) matched.add(f)
  }
  return [...matched].sort()
}

// ---------------------------------------------------------------------------
// Core audit (exported for tests)
// ---------------------------------------------------------------------------

export function runAudit(opts: RunAuditOptions = {}): RunSummary {
  const config = opts.config ?? loadConfig(CONFIG_PATH)
  const root = opts.projectRoot ?? PROJECT_ROOT
  const targets = resolveTargets(config, opts)

  const staleTerms: StaleTerm[] = []
  for (const absPath of targets) {
    if (!existsSync(absPath)) continue
    const content = readFileSync(absPath, 'utf-8')
    const relPath = relative(root, absPath)
    staleTerms.push(...detectStale({ filePath: relPath, content, config }))
  }

  return { filesScanned: targets.length, staleTerms }
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
    reportName: 'vocabulary-current',
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
    result: summary.staleTerms.length === 0 ? 'pass' : 'fail',
    summary: {
      filesScanned: summary.filesScanned,
      staleTerms: summary.staleTerms.length,
    },
    data: { staleTerms: summary.staleTerms },
  })

  process.exit(summary.staleTerms.length === 0 ? 0 : 1)
}

const invokedAsCli =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedAsCli) {
  main()
}
