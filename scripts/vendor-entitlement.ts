// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * Vendor `wbd-entitlement`'s source into `backend/src/entitlement/`.
 *
 * ## Why vendored and not a dependency
 *
 * `backend/src/` ships to Weaver-Free, which is a public AGPL repo, and a public clone must build
 * with no Verdaccio, no private registry and no fleet access. A `@wbd/entitlement` dependency
 * would make the Free repo unbuildable by anyone outside WBD — which is not a packaging
 * inconvenience, it is a licence problem: AGPL requires the complete corresponding source.
 *
 * Same reason and same shape as the engram vocab, which is pushed into `scripts/data/` rather than
 * fetched.
 *
 * ## What it rewrites
 *
 * Headers. Upstream files carry wbd-entitlement's dual-licence wording; under `code/` Weaver's
 * convention is the AGPL/BSL line. A copied file that keeps the source repo's licence wording is
 * precisely the drift `verify-copied-claims.md` describes — the part that looks adapted while the
 * claim underneath is still the other project's.
 *
 * Run: `npx tsx scripts/vendor-entitlement.ts [--upstream <path>]`
 * Check: `npm run audit:entitlement-vendor`
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'

export const DEFAULT_UPSTREAM = '/home/mark/Projects/active/wbd-entitlement'
export const VENDOR_DIR = new URL('../backend/src/entitlement/', import.meta.url).pathname
export const SUBTREES = ['format', 'verify', 'issue'] as const

/** Repo root for paths that are not under the vendored library tree. */
export const CODE_DIR = new URL('../', import.meta.url).pathname

/**
 * Individual files vendored OUTSIDE `backend/src/entitlement/`, as `[upstream, local]` pairs.
 *
 * `audit:authority-binding` is shared source, not shared runtime: it must live in this repo's own
 * `scripts/` because that directory ships to Weaver-Free, where the upstream checkout does not
 * exist. It was therefore hand-copied — and a hand-copy with no drift check is precisely the
 * class `audit:entitlement-vendor` exists to close, one directory over. It diverged the first
 * time it was edited, which is how it got noticed.
 *
 * Listed here so the same reheader + drift check covers it. Anything added to this list becomes
 * read-only in this repo: edit upstream, re-run this script.
 */
export const VENDORED_FILES: ReadonlyArray<readonly [string, string]> = [
  ['code/scripts/verify-authority-binding.ts', 'scripts/verify-authority-binding.ts'],
] as const

const HEADER_RE = /^\/\/ Copyright \(c\) 2026 whizBANG Developers LLC\. All rights reserved\.\n(?:\/\/[^\n]*\n)+/

/** The header every vendored file carries in this repo. */
export function weaverHeader(rev: string): string {
  return (
    '// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.\n' +
    '// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.\n' +
    '//\n' +
    `// VENDORED from wbd-entitlement@${rev} — do not edit here.\n` +
    '// Edit upstream, re-run scripts/vendor-entitlement.ts. audit:entitlement-vendor fails on drift.\n'
  )
}

/** Strip the source header and apply this repo's. Exported so the auditor can reproduce it. */
export function reheader(source: string, rev: string): string {
  const m = HEADER_RE.exec(source)
  if (!m) throw new Error('vendored file has no recognisable copyright header')
  return weaverHeader(rev) + '\n' + source.slice(m[0].length).replace(/^\n+/, '')
}

export function walkTs(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkTs(full))
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

/** The upstream paths this repo vendors from, derived rather than restated. */
const UPSTREAM_PATHS: readonly string[] = [
  ...SUBTREES.map((s) => `code/src/${s}`),
  ...VENDORED_FILES.map(([from]) => from),
]

/**
 * The upstream commit the vendored CONTENT came from — not upstream's HEAD.
 *
 * `rev-parse HEAD` looks equivalent and is not. It names whatever upstream committed last, so a
 * change touching nothing this repo vendors — a doc, a test, a knowledge entry — moves the stamp
 * and every vendored header goes stale. `audit:entitlement-vendor` then reports DRIFTED on files
 * whose bytes are perfectly correct, and the only way to clear it is a re-vendor commit that
 * changes 13 headers and nothing else. Measured: an upstream commit touching only
 * `code/docs/knowledge/` failed this repo's pre-push.
 *
 * Worse than the churn is what the churn teaches. A drift auditor that fires when nothing
 * drifted trains its reader to re-run the fix without reading the finding, which is exactly the
 * habit that lets a REAL drift through.
 *
 * So the stamp answers the question a reader actually asks of it — "which upstream commit is this
 * file a copy of?" — by asking git for the last commit that touched the vendored paths.
 */
export function contentRev(upstream: string): string {
  // REFUSE ON A SHALLOW UPSTREAM — it answers this question wrongly rather than not at all.
  //
  // `git log -1 -- <paths>` needs history to find the last commit that touched those paths. In a
  // `--depth 1` clone the shallow boundary commit looks like it introduced EVERY path, so git
  // returns the tip. Measured: against a depth-1 clone whose tip was a docs-only commit, this
  // returned that commit instead of the real content rev one commit earlier.
  //
  // That is why an emptiness check is not enough and why the obvious guard is worse than none: it
  // never fires, so it reads as protection while every stamp is quietly wrong. `actions/checkout`
  // defaults to depth 1, so any CI job that checks the upstream out is in this state by default.
  const shallow = execFileSync('git', ['-C', upstream, 'rev-parse', '--is-shallow-repository'], {
    encoding: 'utf-8',
  }).trim()
  if (shallow !== 'false') {
    throw new Error(
      `${upstream} is a shallow clone. The vendored-content rev cannot be determined from one — ` +
        'git reports the shallow boundary as the commit that introduced every path, so the stamp ' +
        'would be plausible and wrong. Check the upstream out with full history (fetch-depth: 0).',
    )
  }

  // `--` separates paths from revs; without it a path that looks like a ref is ambiguous.
  const rev = execFileSync(
    'git',
    ['-C', upstream, 'log', '-1', '--format=%h', '--', ...UPSTREAM_PATHS],
    { encoding: 'utf-8' },
  ).trim()

  if (!rev) {
    throw new Error(
      `no commit in ${upstream} touches any vendored path (${UPSTREAM_PATHS.join(', ')}) — ` +
        'the paths have moved upstream. Refusing to stamp a header with a rev that would be wrong.',
    )
  }
  return rev
}

/** What the vendored tree SHOULD contain, given an upstream checkout. */
export function expectedTree(upstream: string): { rev: string; files: Map<string, string> } {
  const rev = contentRev(upstream)

  const files = new Map<string, string>()
  for (const subtree of SUBTREES) {
    const root = join(upstream, 'code/src', subtree)
    for (const file of walkTs(root)) {
      files.set(join(subtree, relative(root, file)), reheader(readFileSync(file, 'utf-8'), rev))
    }
  }
  return { rev, files }
}

/** Standalone vendored files, keyed by their path relative to `code/`. */
export function expectedFiles(upstream: string, rev: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const [from, to] of VENDORED_FILES) {
    out.set(to, reheader(readFileSync(join(upstream, from), 'utf-8'), rev))
  }
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { upstream: { type: 'string' } } })
  const upstream = values.upstream ?? DEFAULT_UPSTREAM

  if (!existsSync(upstream)) {
    console.error(`vendor-entitlement: no upstream checkout at ${upstream}`)
    process.exit(1)
  }

  const { rev, files } = expectedTree(upstream)

  // Remove only the subtrees this script OWNS, never the whole directory.
  //
  // It used to `rm -rf` VENDOR_DIR, which destroyed a hand-written product file someone had put
  // alongside the vendored code — silently, and only visible because the next step failed to read
  // it. A tool that deletes a directory a human might reasonably write into is a footgun no matter
  // how clearly the README says not to. The profile now lives outside this tree entirely, and this
  // narrower delete means a future stray file is merely misplaced rather than destroyed.
  for (const subtree of SUBTREES) {
    rmSync(join(VENDOR_DIR, subtree), { recursive: true, force: true })
  }
  for (const [rel, body] of files) {
    const target = join(VENDOR_DIR, rel)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body)
  }
  console.log(`vendored ${files.size} file(s) from wbd-entitlement@${rev} → backend/src/entitlement/`)

  // Standalone files, written in place rather than into a wiped subtree — each one lives beside
  // this repo's own code, so there is no directory here that may be deleted wholesale.
  const standalone = expectedFiles(upstream, rev)
  for (const [rel, body] of standalone) {
    const target = join(CODE_DIR, rel)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body)
    console.log(`vendored wbd-entitlement@${rev} → ${rel}`)
  }
}
