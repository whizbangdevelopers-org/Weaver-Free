// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * `backend/src/entitlement/` must be a faithful copy of `wbd-entitlement`.
 *
 * The licence mechanism is shared across products and vendored rather than depended on,
 * because `backend/src/` ships to Weaver-Free and a public clone must build with no private
 * registry. Vendoring buys that at the cost of a copy that can drift — so this is the check that
 * makes the copy honest, in the same shape as `audit:engram-vocab-fresh`.
 *
 * ## Why it SKIPS when upstream is absent, rather than failing
 *
 * `scripts/` ships to Weaver-Free too, and a public clone has no `wbd-entitlement` checkout. An
 * auditor whose universe is wider than its consumer's can only produce false failures there, which
 * is how a check gets deleted. So: assert the copy agrees whenever upstream IS present — which is
 * the only place the two could drift — and skip loudly otherwise.
 *
 * That is deliberately NOT "refuse, don't degrade". The condition here cannot change the answer:
 * a clone with no upstream has nothing to compare against, and no verdict it could reach would be
 * more correct. Compare with `generate-license-authority.ts`, where a missing manifest DOES change
 * the answer and therefore fails.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  DEFAULT_UPSTREAM,
  VENDOR_DIR,
  CODE_DIR,
  SUBTREES,
  expectedTree,
  expectedFiles,
} from './vendor-entitlement.js'

/**
 * Compare an expected tree against what is actually vendored. Pure, so it can be corpus-tested.
 *
 * Extracted from the scan loop rather than left inline because this auditor had NO proof it could
 * fail — and a byte-comparison is exactly the kind of check that looks self-evidently correct
 * while being wrong in one direction. The three findings are not symmetric: MISSING and DRIFTED
 * catch an incomplete or edited copy, and UNTRACKED catches the opposite drift — a file added
 * INSIDE the vendored tree, which is how a hand-written product file ends up somewhere the vendor
 * step will delete it on its next run.
 */
export function compareTrees(
  expected: ReadonlyMap<string, string>,
  actual: ReadonlyMap<string, string>,
): string[] {
  const problems: string[] = []
  for (const [rel, want] of expected) {
    if (!actual.has(rel)) problems.push(`MISSING   ${rel}`)
    else if (actual.get(rel) !== want) problems.push(`DRIFTED   ${rel}`)
  }
  for (const rel of actual.keys()) {
    if (!expected.has(rel)) problems.push(`UNTRACKED ${rel} — not present upstream`)
  }
  return problems
}

// ---------------------------------------------------------------------------
// Corpus — both halves, and the scanner refuses to report unless it passes.
//
// The IGNORE half is the one that matters here. This auditor gates the vendor step, so a rule
// that reports drift on an identical tree makes re-vendoring impossible and gets removed; at
// that point nothing checks the copy at all, which is strictly worse than the state before.
// ---------------------------------------------------------------------------

const CASES: Array<{ name: string; expected: [string, string][]; actual: [string, string][]; catches: boolean }> = [
  // CATCH
  { name: 'a file edited in place', expected: [['format/a.ts', 'X']], actual: [['format/a.ts', 'Y']], catches: true },
  { name: 'a file never copied', expected: [['format/a.ts', 'X']], actual: [], catches: true },
  { name: 'a file added inside the vendored tree', expected: [], actual: [['format/mine.ts', 'X']], catches: true },
  { name: 'one of several drifted', expected: [['a.ts', 'X'], ['b.ts', 'Y']], actual: [['a.ts', 'X'], ['b.ts', 'Z']], catches: true },
  { name: 'whitespace-only edit', expected: [['a.ts', 'const x = 1\n']], actual: [['a.ts', 'const x = 1 \n']], catches: true },
  { name: 'a truncated file', expected: [['a.ts', 'AAAA']], actual: [['a.ts', 'AAA']], catches: true },

  // IGNORE
  { name: 'an identical tree', expected: [['format/a.ts', 'X'], ['verify/b.ts', 'Y']], actual: [['format/a.ts', 'X'], ['verify/b.ts', 'Y']], catches: false },
  { name: 'an empty tree on both sides', expected: [], actual: [], catches: false },
  { name: 'identical content with unicode', expected: [['a.ts', '// ✓ — é\n']], actual: [['a.ts', '// ✓ — é\n']], catches: false },
  { name: 'order does not matter', expected: [['a.ts', 'X'], ['b.ts', 'Y']], actual: [['b.ts', 'Y'], ['a.ts', 'X']], catches: false },
]

const corpusFailures = CASES.flatMap((c) => {
  const hit = compareTrees(new Map(c.expected), new Map(c.actual)).length > 0
  return hit === c.catches ? [] : [`  ${c.catches ? 'MISSED' : 'FALSE POSITIVE'}: ${c.name}`]
})
if (corpusFailures.length > 0) {
  console.error('audit:entitlement-vendor — CORPUS FAILED, refusing to scan:')
  console.error(corpusFailures.join('\n'))
  process.exit(1)
}
const catchCount = CASES.filter((c) => c.catches).length
console.log(`auditor-contract: catch=${catchCount} ignore=${CASES.length - catchCount}`)

if (process.argv.includes('--self-test')) process.exit(0)

const upstream = process.env.ENTITLEMENT_UPSTREAM ?? DEFAULT_UPSTREAM

if (!existsSync(join(upstream, 'code/src/format'))) {
  console.log(
    `audit:entitlement-vendor — SKIP: no wbd-entitlement checkout at ${upstream}.\n` +
      '  The vendored copy cannot be compared against an upstream that is not here. This is the\n' +
      '  expected state in a Weaver-Free clone; in Dev it means the sibling repo is missing.',
  )
  process.exit(0)
}

function walkTs(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkTs(full))
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

const { rev, files } = expectedTree(upstream)

// Read the vendored tree into the same shape the corpus uses, then compare with the SAME function
// the corpus exercises. Keeping the live path and the tested path identical is the point — a
// corpus over a reimplementation of the comparison would prove nothing about this run.
const actual = new Map<string, string>()
for (const subtree of SUBTREES) {
  const dir = join(VENDOR_DIR, subtree)
  if (!existsSync(dir)) continue
  for (const file of walkTs(dir)) {
    actual.set(relative(VENDOR_DIR, file), readFileSync(file, 'utf-8'))
  }
}

const problems = compareTrees(files, actual)

// Standalone vendored files (see VENDORED_FILES). Compared by the same function, but WITHOUT the
// UNTRACKED leg — these live among this repo's own scripts, so "present here, absent upstream" is
// the normal state of every neighbouring file rather than evidence of drift.
const wantFiles = expectedFiles(upstream, rev)
for (const [rel, want] of wantFiles) {
  const target = join(CODE_DIR, rel)
  if (!existsSync(target)) problems.push(`MISSING   ${rel}`)
  else if (readFileSync(target, 'utf-8') !== want) problems.push(`DRIFTED   ${rel}`)
}

if (problems.length > 0) {
  console.error(`\naudit:entitlement-vendor — vendored copy disagrees with wbd-entitlement@${rev}:\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  Fix by re-running the vendor step, never by editing the copy:\n' +
      '    npx tsx scripts/vendor-entitlement.ts\n' +
      '  If the change belongs to Weaver rather than the shared mechanism, it belongs OUTSIDE\n' +
      '  backend/src/entitlement/ — see backend/src/license-profile.ts for where product-specific\n' +
      '  code goes.\n',
  )
  process.exit(1)
}

console.log(`audit:entitlement-vendor — ${files.size + wantFiles.size} file(s) match wbd-entitlement@${rev}`)
