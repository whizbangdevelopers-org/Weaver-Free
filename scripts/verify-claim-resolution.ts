// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:claim-resolution — a security or compliance document may not cite code that does not exist.
 *
 * Two documents make claims about the codebase, both are read as authoritative, and neither was
 * checked by anything:
 *
 *   1. The internal security findings register (Dev-only; absent on the public mirror, where this
 *      auditor degrades to the mappings below). Every entry carries a `**Location:**` naming the
 *      file the finding lives in, and it is read at every release as a gate.
 *   2. `code/docs/security/compliance/*.md` — the NIST / PCI / SOC 2 / CIS / HIPAA mappings, which
 *      SHIP TO CUSTOMERS as branded PDFs and name the mechanism satisfying each control.
 *
 * Both drift, and the drift is invisible because prose does not fail. Measured when this was
 * written: the register cited `backend/src/services/premium/adapters/email-adapter.ts` and
 * `premium/network-manager.ts` — `services/premium/` was renamed to `services/weaver/` with the
 * tier rename, so two findings pointed at nothing. Separately, four entries described postures the
 * code had moved past (localStorage tokens, reflect-origin CORS), and one was wrong in the UNSAFE
 * direction: "CSRF not applicable — not cookies" survived the move to cookie-borne auth.
 *
 * **Scope, stated precisely, because two things were deliberately left out.**
 *
 * It checks cited PATHS. It does not check cited IDENTIFIERS, and that is a decision rather than
 * an omission: a first draft resolved `requireRole()` against a symbol index of our own tree, and
 * on the real corpus it flagged `execFile()`, `reply.send()` and `core.setFailed()` — Node,
 * Fastify and GitHub-Actions APIs that are perfectly valid citations and will never be in our
 * index. Separating "our symbol" from "a third-party API" needs a curated allowlist, which is a
 * keyword-avoidance puzzle rather than a check, and an auditor that flags legitimate input gets
 * switched off, after which it catches nothing at all.
 *
 * It also does not verify that a claim is TRUE. "requireRole() on every route" resolves perfectly
 * well while being false. A quantified claim needs a human reader, and saying so here is the point:
 * a green run means every citation points at something real, not that every claim is accurate.
 *
 * What it closes is the cheap and common half: a citation that has quietly stopped pointing at
 * anything, which is precisely what a directory rename produces.
 *
 * **The notation this enforces:** a backticked path is a CLAIM THAT THE FILE EXISTS. That matters
 * when documenting a rename, which these documents do constantly — name the live destination in
 * backticks and leave the dead origin in prose. Rewording to satisfy a checker is normally the
 * thing to refuse, and this is the exception that proves the rule: the backtick is the assertion,
 * so removing it from a path you are describing as GONE is correcting the claim, not dodging it.
 * (Learned the hard way — the paragraph in the register announcing this auditor tripped it.)
 *
 * Usage:
 *   npx tsx scripts/verify-claim-resolution.ts
 *   npx tsx scripts/verify-claim-resolution.ts --self-test
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = resolve(HERE, '..')            // code/
const REPO = resolve(PKG, '..')            // repo root

const RED = '\x1b[31m'; const GREEN = '\x1b[32m'; const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'; const RESET = '\x1b[0m'

const REGISTER = join(REPO, 'business/legal/SECURITY-AUDIT.md')
const MAPPING_DIR = join(PKG, 'docs/security/compliance')

/**
 * Backticked things that are prose, not code. Kept deliberately small: a long ignore list turns
 * the auditor into a keyword-avoidance puzzle, which is the shape `never-game-auditors.md` warns
 * about. Each entry is here because it is a package name, an HTTP artefact, or a config key —
 * categories that legitimately have no file and no symbol.
 */
const NOT_CODE = new Set([
  'true', 'false', 'null', 'undefined', 'N/A',
])

/** Package specifiers (`@fastify/static`, `bcrypt`) resolve to node_modules, not to our tree. */
function isPackageSpecifier(s: string): boolean {
  if (s.startsWith('@') && s.includes('/')) return true
  return /^[a-z0-9-]+$/.test(s) && existsSync(join(PKG, 'node_modules', s))
}

export interface Citation {
  doc: string
  line: number
  raw: string
  kind: 'path'
}

/**
 * A citation that is a repo path: contains a slash and ends in a known source extension.
 *
 * The extension is REQUIRED, and the first draft's `|| head.endsWith('/')` fallback is why. Route
 * patterns are cited constantly in these documents — `/ws/console/:vmName`, `DELETE
 * /api/workload/:name` — and stripping the `:param` off `/ws/console/:vmName` leaves
 * `/ws/console/`, which ends in a slash. Every HTTP route in both documents was reported as a
 * missing file. Routes are not paths and this auditor has nothing to say about them.
 */
export function looksLikePath(s: string): boolean {
  const raw = s.trim()
  if (/\s/.test(raw)) return false                       // a shell command line, not a citation
  const head = raw.split(':')[0]!.split('#')[0]!.trim()
  if (!head.includes('/')) return false
  if (head.startsWith('/')) return false                  // an absolute path or an HTTP route
  if (isPackageSpecifier(head)) return false
  return /\.(ts|js|mjs|cjs|vue|md|nix|ya?ml|json|sh|html|css|scss)$/.test(head)
}

/**
 * Pull code citations out of a document.
 *
 * `**Location:**` lines in the register are paths. Compliance mapping tables cite mechanisms as
 * backticked identifiers (`requireRole()`, `VmAclStore.isAllowed()`). Both come out as citations;
 * the resolver decides how to check each.
 */
export function extractCitations(doc: string, text: string): Citation[] {
  const out: Citation[] = []
  text.split('\n').forEach((line, idx) => {
    // Skip fenced code and quoted example blocks — those are illustrations, not claims.
    if (/^\s*(```|>)/.test(line)) return
    for (const m of line.matchAll(/`([^`\n]+)`/g)) {
      const raw = m[1]!.trim()
      if (!raw || NOT_CODE.has(raw)) continue
      if (raw.includes('*')) continue                      // a glob is a set, not a citation
      if (looksLikePath(raw)) out.push({ doc, line: idx + 1, raw, kind: 'path' })
    }
  })
  return out
}

/**
 * Resolve a path citation against every base these documents legitimately use.
 *
 * The register mixes `code/backend/src/...` (first-pass entries) with `backend/src/...` and bare
 * `routes/agent.ts` (later ones), and the compliance mappings are written relative to `code/`.
 * Accepting any of them is deliberate: the invariant worth enforcing is "this points at something
 * real", not a house style for citations. A path that resolves under NO base is dead, which is
 * what a directory rename produces and what this exists to catch.
 */
const BASES = ['', 'code', 'code/backend', 'code/backend/src', 'code/src'] as const

export function resolvePath(raw: string): boolean {
  const head = raw.split(':')[0]!.split('#')[0]!.trim()
  return BASES.some(b => existsSync(join(REPO, b, head)))
}

// --------------------------------------------------------------------------------------------
// Self-test
// --------------------------------------------------------------------------------------------

const EXTRACT_CATCH: [string, string][] = [
  ['a Location path', '- **Location:** `code/backend/src/routes/ws.ts:44`'],
  ['a path with no line number', 'see `code/nixos/default.nix`'],
  ['a path with a line range', '- **Location:** `code/backend/src/index.ts:87-93`'],
  ['a bare relative path', 'fixed in `routes/agent.ts`'],
  ['two paths on one line', '`code/src/boot/axios.ts:27`, `code/src/stores/auth-store.ts`'],
]

// The IGNORE half is the one that decides whether this auditor survives contact with the real
// documents. Every case below was a live false positive in the first draft.
const EXTRACT_IGNORE: [string, string][] = [
  ['a fenced code block', '```\ncode/backend/src/x.ts\n```'],
  ['a blockquote example', '> `code/some/example.ts` is illustrative'],
  ['an HTTP route with a param', 'console at `/ws/console/:vmName` has no rate limit'],
  ['a method-and-route citation', 'the `DELETE /api/workload/:name` handler'],
  ['a route with an extension-free segment', 'served from `/api/compliance/:slug/pdf`'],
  ['a package specifier', '`@fastify/static` is pinned at 9.3.0'],
  ['a regex literal', 'validated with `/^v\\d+\\.\\d+\\.\\d+$/`'],
  ['a shell command line', 'run `cd testing/e2e-docker && ./scripts/run-tests.sh`'],
  ['a third-party call', 'aborts via `core.setFailed()`'],
  ['a bare identifier', 'every command uses `execFile()`'],
  ['a glob', 'covers `code/docs/security/compliance/*.md`'],
  ['a config value', 'defaults to `true`'],
]

const PATH_CATCH = [
  'code/backend/src/services/premium/adapters/email-adapter.ts',   // the premium -> weaver rename
  'code/nope/missing.ts',
]
const PATH_IGNORE = [
  'code/backend/src/routes/ws.ts',        // repo-root base
  'backend/src/routes/ws.ts',             // code/ base
  'routes/ws.ts',                         // code/backend/src/ base
  'code/package.json',
]

function selfTest(): boolean {
  const failures: string[] = []
  for (const [name, text] of EXTRACT_CATCH) {
    if (extractCitations('t.md', text).length === 0) failures.push(`CATCH missed (extract): ${name}`)
  }
  for (const [name, text] of EXTRACT_IGNORE) {
    const hits = extractCitations('t.md', text)
    if (hits.length > 0) failures.push(`IGNORE wrongly extracted: ${name} (${hits.map(h => h.raw).join(', ')})`)
  }
  for (const p of PATH_CATCH) if (resolvePath(p)) failures.push(`CATCH missed (path resolves but should not): ${p}`)
  for (const p of PATH_IGNORE) if (!resolvePath(p)) failures.push(`IGNORE wrongly unresolved (path): ${p}`)

  const c = EXTRACT_CATCH.length + PATH_CATCH.length
  const i = EXTRACT_IGNORE.length + PATH_IGNORE.length
  console.log(`${DIM}  auditor-contract: catch=${c} ignore=${i}${RESET}`)
  if (failures.length > 0) {
    console.error(`${RED}${BOLD}SELF-TEST FAILED${RESET}`)
    for (const f of failures) console.error(`  ${RED}✗${RESET} ${f}`)
    return false
  }
  return true
}

// --------------------------------------------------------------------------------------------

function main(): void {
  const selfTestOnly = process.argv.includes('--self-test')

  console.log(`${BOLD}Claim Resolution${RESET}`)
  console.log(`${DIM}a security or compliance document may not cite code that does not exist${RESET}\n`)

  if (!selfTest()) {
    console.error(`\n${RED}${BOLD}RESULT: FAIL${RESET} — refusing to scan on a failed self-test`)
    process.exit(1)
  }
  if (selfTestOnly) {
    console.log(`\n${GREEN}${BOLD}SELF-TEST PASSED${RESET}`)
    return
  }

  const docs: [string, string][] = []
  if (existsSync(REGISTER)) docs.push(['business/legal/SECURITY-AUDIT.md', readFileSync(REGISTER, 'utf-8')])
  if (existsSync(MAPPING_DIR)) {
    for (const f of readdirSync(MAPPING_DIR).filter(f => f.endsWith('.md')).sort()) {
      docs.push([`code/docs/security/compliance/${f}`, readFileSync(join(MAPPING_DIR, f), 'utf-8')])
    }
  }
  // Refuse to report over an empty universe — "found nothing" and "looked at nothing" print the
  // same green tick otherwise.
  if (docs.length === 0) {
    console.error(`${RED}✗${RESET} no security or compliance documents found — refusing to report`)
    process.exit(1)
  }

  const citations = docs.flatMap(([name, text]) => extractCitations(name, text))
  const unresolved = citations.filter(c => !resolvePath(c.raw))
  console.log(`${DIM}  ${docs.length} document(s) · ${citations.length} path citation(s) checked against ${BASES.length} base(s)${RESET}`)

  if (unresolved.length > 0) {
    console.error('')
    for (const u of unresolved) {
      console.error(`  ${RED}✗${RESET} ${u.doc}:${u.line} — \`${u.raw}\` does not resolve`)
    }
    console.error(
      `\n${RED}${BOLD}RESULT: FAIL${RESET} — ${unresolved.length} citation(s) point at code that does not exist.\n` +
      `${DIM}  A renamed directory or a deleted symbol leaves the claim behind, and prose does not fail on its own.${RESET}`,
    )
    process.exit(1)
  }

  console.log(`\n${GREEN}${BOLD}RESULT: PASS${RESET} — every cited construct resolves`)
}

main()
