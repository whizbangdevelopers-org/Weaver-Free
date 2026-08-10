// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-version-parity.ts — audit:version-parity
 *
 * The product's version appears in four files that must agree, and until 2026-08-09 nothing
 * checked that they did. `tui/package.json` had drifted to 1.0.3 against 1.0.5 everywhere else,
 * so a user could install Weaver 1.0.5 and get a TUI stamped two patches behind. The TUI ships —
 * only `tui/src/__tests__/` is sync-excluded — and MASTER-PLAN calls it "a first-class client,
 * not a convenience tool".
 *
 * `version-drift-check.yml` sounds like it covers this and does not: it watches *dependency*
 * majors against what Quasar accepts. Nothing read these four files together.
 *
 * Release checklist step 1 names all four. This is the control that makes step 1 true — a step
 * that says "update these four" is a wish; an auditor is a control (~/.claude/rules — a control
 * you must remember is not a control).
 *
 * DELIBERATELY NOT INCLUDED: the internal dev MCP server’s package.json (0.1.0). It is dev tooling,
 * sync-excluded, and never shipped, so it versions independently by design. Listing it here
 * would force a meaningless bump every release and teach the next person that the rule is noise.
 * That exclusion is named, not a wildcard, so a future package cannot inherit it by accident.
 *
 *   npm run audit:version-parity
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CODE_ROOT = resolve(__dirname, '..')

/** Every file carrying the shipped product version. Add one here when a new shipped surface appears. */
const JSON_SURFACES = ['package.json', 'backend/package.json', 'tui/package.json']
const NIX_SURFACE = 'nixos/package.nix'

/** `package.json` is the source; everything else must equal it. */
const SOURCE = 'package.json'

interface Reading { file: string; version: string | null; detail?: string }

function readJsonVersion(rel: string): Reading {
  const abs = resolve(CODE_ROOT, rel)
  if (!existsSync(abs)) return { file: rel, version: null, detail: 'file missing' }
  try {
    const v = (JSON.parse(readFileSync(abs, 'utf8')) as { version?: unknown }).version
    if (typeof v !== 'string' || !v) return { file: rel, version: null, detail: 'no string "version" field' }
    return { file: rel, version: v }
  } catch (e) {
    return { file: rel, version: null, detail: `unparseable: ${(e as Error).message}` }
  }
}

function readNixVersion(rel: string): Reading {
  const abs = resolve(CODE_ROOT, rel)
  if (!existsSync(abs)) return { file: rel, version: null, detail: 'file missing' }
  const text = readFileSync(abs, 'utf8')
  // `version = "1.0.5";` — first assignment wins. Anchored to the attribute so a version string
  // inside a URL or a comment cannot be mistaken for the declaration.
  const m = /^\s*version\s*=\s*"([^"]+)"/m.exec(text)
  if (!m) return { file: rel, version: null, detail: 'no `version = "…"` attribute found' }
  return { file: rel, version: m[1]! }
}

const readings: Reading[] = [
  ...JSON_SURFACES.map(readJsonVersion),
  readNixVersion(NIX_SURFACE),
]

// An unreadable surface is a FAILURE, not a skip. A parity check that quietly drops a file it
// could not read reports agreement among whatever is left — the shape this auditor exists to end.
const unreadable = readings.filter((r) => r.version === null)
if (unreadable.length > 0) {
  console.error('audit:version-parity FAIL — could not read the version from:')
  for (const r of unreadable) console.error(`  ${r.file} — ${r.detail}`)
  process.exit(1)
}

const source = readings.find((r) => r.file === SOURCE)!
const mismatched = readings.filter((r) => r.version !== source.version)

if (mismatched.length === 0) {
  console.log(
    `audit:version-parity PASS — all ${readings.length} shipped version surfaces read ${source.version}`,
  )
  process.exit(0)
}

console.error(`audit:version-parity FAIL — ${mismatched.length} surface(s) disagree with ${SOURCE} (${source.version}):`)
for (const r of mismatched) console.error(`  ${r.file}  ${r.version}   (expected ${source.version})`)
console.error(
  '\n  Release checklist step 1 updates all of these together. If a surface is meant to version' +
    '\n  independently, exclude it BY NAME in scripts/verify-version-parity.ts with the reason —' +
    '\n  never by widening a pattern.',
)
process.exit(1)
