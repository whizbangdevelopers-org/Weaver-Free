// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * E2E Docs Auditor
 *
 * Enforces:
 *   1. Every testing/e2e/*.spec.ts carries a JSDoc header with
 *      @purpose, @feature, @since tags.
 *   2. @feature tag values are drawn from a maintained allowlist so
 *      a typo doesn't silently create a ghost category.
 *   3. @since values match a known version pattern (pre-v1.0 or v\d+.\d+(.\d+)?).
 *   4. the generated coverage catalog under docs/ is up to date with the spec headers —
 *      generated content diffs cleanly against what the generator
 *      would emit today.
 *
 * Pattern match: sync-deck's "generator output must match committed
 * file" is the same model. Works cleanly with
 * audit:generated-artifact-freshness because renderCoverage is
 * deterministic (no timestamps).
 *
 * Invocation:
 *   npm run audit:e2e-docs
 */

import { execFileSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { gatherSpecs, renderCoverage } from './generate-e2e-coverage.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')
/** Repo-relative, because the baseline is read out of git rather than off disk. */
const OUTPUT_REL = 'code/docs/E2E-COVERAGE.md'

/**
 * Committed/staged content for a repo-relative path — the index first, then HEAD.
 *
 * Returns '' when the path is neither staged nor committed (nothing to drift from yet). Never
 * reads the working tree: a git blob is immutable for the duration of the run, so it cannot be
 * rewritten underneath the comparison by a generator or a hook.
 */
function gitBaseline(relPath: string): string {
  for (const ref of [`:${relPath}`, `HEAD:${relPath}`]) {
    try {
      return execFileSync('git', ['show', ref], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
      })
    } catch {
      // not staged / not committed under this ref — try the next
    }
  }
  return ''
}

// Feature-tag allowlist. Every @feature value on every spec must be
// in this set. Update when new coherent feature areas are introduced;
// don't add one-off tags.
const FEATURE_ALLOWLIST = new Set<string>([
  'auth',
  'authz',
  'agent',
  'audit',
  'console',
  'containers',
  'dashboard',
  'demo',
  'demo-public',
  'demo-private',
  'forms',
  'funnel',
  'help',
  'host-config',
  'host-info',
  'keyboard',
  'license',
  'metrics',
  // A Toll is a licence the OPERATOR owns (a Windows key, a RHEL subscription) with seats and
  // expiry — deliberately a different feature area from 'license', which is Weaver's own product
  // key. Sharing a tag would merge two coverage stories that have different owners and different
  // failure modes, which is the same conflation the distinct noun exists to prevent.
  'toll',
  'mobile',
  'navigation',
  'network',
  'notifications',
  'provisioning',
  'rbac',
  'screenshots',
  'security',
  'session',
  'settings',
  'smoke',
  'tiers',
  'users',
  'workloads',
])

const VERSION_RE = /^(pre-v1\.0|v\d+\.\d+(?:\.\d+)?)$/

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

interface Violation {
  check: string
  detail: string
}

function main(): void {
  console.log(`${BOLD}E2E Docs Audit${RESET}`)
  console.log(`${DIM}Every spec carries a JSDoc header; E2E-COVERAGE.md stays fresh.${RESET}`)
  console.log()

  const violations: Violation[] = []
  const result = gatherSpecs()

  // Check 1: every spec has a header.
  for (const missing of result.missing) {
    violations.push({
      check: 'header-missing',
      detail: `testing/e2e/${missing} — JSDoc header with @purpose, @feature, @since is required`,
    })
  }

  // Check 2: feature-tag allowlist.
  for (const entry of result.entries) {
    if (entry.features.length === 0) {
      violations.push({
        check: 'feature-empty',
        detail: `testing/e2e/${entry.filename} — @feature tag is empty`,
      })
      continue
    }
    for (const f of entry.features) {
      if (!FEATURE_ALLOWLIST.has(f)) {
        violations.push({
          check: 'feature-unknown',
          detail: `testing/e2e/${entry.filename} — @feature '${f}' not in allowlist (edit scripts/verify-e2e-docs.ts FEATURE_ALLOWLIST if this is a legit new category)`,
        })
      }
    }
  }

  // Check 3: version pattern.
  for (const entry of result.entries) {
    if (!VERSION_RE.test(entry.since)) {
      violations.push({
        check: 'since-format',
        detail: `testing/e2e/${entry.filename} — @since '${entry.since}' does not match expected format (pre-v1.0, vX.Y, or vX.Y.Z)`,
      })
    }
  }

  // Check 4: generated file is fresh.
  //
  // The baseline is GIT, never the working tree. This auditor does not write — it renders in
  // memory — so it cannot mask ITSELF, and that is exactly what makes reading the working tree
  // look safe here. It isn't: anything that regenerates the coverage catalog in place before this
  // runs (the generator, a pre-commit hook, another auditor, a developer) leaves the tree fresh
  // while the COMMIT stays stale, and the comparison then answers a question nobody asked. What
  // ships is the commit, so the commit is what must be checked.
  //
  // `:path` is the staged blob — what the next commit will actually contain — with `HEAD:path` as
  // the fallback when nothing is staged. A git blob is immutable for the duration of the run and
  // therefore cannot be rewritten underneath the comparison. Same helper and same reasoning as
  // verify-generated-artifact-freshness.ts's gitBaseline().
  const expected = renderCoverage(result)
  const actual = gitBaseline(OUTPUT_REL)
  if (!actual) {
    violations.push({
      check: 'coverage-missing',
      detail: `docs/E2E-COVERAGE.md is not committed or staged — run: npm run generate:e2e-coverage && git add code/docs/E2E-COVERAGE.md`,
    })
  }
  if (actual && actual !== expected) {
    violations.push({
      check: 'coverage-stale',
      detail: `docs/E2E-COVERAGE.md is out of date — run: npm run generate:e2e-coverage`,
    })
  }

  console.log(`  ${GREEN}✓${RESET} Scanned ${result.entries.length} catalogued spec(s); ${result.missing.length} missing header(s)`)

  if (violations.length === 0) {
    console.log()
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — E2E docs intact`)
    process.exit(0)
  }

  console.log()
  for (const v of violations) {
    const color = v.check === 'coverage-stale' || v.check === 'coverage-missing' ? YELLOW : RED
    console.log(`  ${color}✗${RESET} [${v.check}] ${v.detail}`)
  }
  console.log()
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${violations.length} violation(s)`)
  process.exit(1)
}

main()
