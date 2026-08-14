// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:extension-targets — an extension's advertised arrival must be possible, and must not pass.
 *
 * WHY THIS EXISTS
 * ---------------
 * The extension registry shows users a `targetVersion` next to every `coming-soon` capability.
 * That is a promise with a date on it, and nothing checked it. verify-demo-plugin-parity.ts
 * parses `targetVersion` and enforces demo↔product parity — it never compares the value against
 * any version. So an extension could advertise a release, that release could ship without it, and
 * every auditor stayed green.
 *
 * Measured 2026-08-14: two DNS extensions both advertised **v1.1.0**, the release then being
 * prepared. Neither could ever have arrived there:
 *   - one is a template-catalog entry, and the catalog itself first ships in v2.0.0. A catalog
 *     entry cannot precede the catalog.
 *   - the other is gated at the Fabrick tier, which does not exist until v2.4.0. An extension
 *     cannot arrive before its own tier.
 *
 * The second one is the sharper class and the reason for rule 2: it is decidable from data the
 * repo already has, and it was wrong for months.
 *
 * TWO RULES
 * ---------
 *   1. OVERDUE   — a `coming-soon` extension whose targetVersion is <= the current package
 *                  version. It claimed to arrive in a release that has already shipped.
 *   2. IMPOSSIBLE— an extension whose minimumTier does not exist until AFTER its own
 *                  targetVersion. Wrong by construction, at any point in time.
 *
 * Rule 2 needs to know when each tier first ships. That lives in the tier matrix's `tiers` block,
 * and every firstVersion there is cross-checked against the release list — so a renumbering that
 * strands a tier's version (as one did in 2026-04, leaving "Fabrick ships at v2.3" in three
 * places) fails here instead of quietly aging.
 *
 * WHAT THIS DELIBERATELY DOES NOT CHECK
 * -------------------------------------
 * Feature dependencies. dns-resolver's real blocker was "needs the template catalog", which is
 * not expressed anywhere machine-readable, so rule 2 cannot catch it — only the tier half is
 * decidable. Said plainly rather than implied by silence: this narrows the class, it does not
 * close it.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = execFileSync('git', ['-C', PKG, 'rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim()

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m', OFF = '\x1b[0m'

export interface Ext {
  id: string
  minimumTier: string
  status: string
  targetVersion?: string
}
export interface Finding { rule: 'overdue' | 'impossible'; id: string; detail: string }

/** "v2.4.0" | "2.4.0" -> [2,4,0]; non-numeric segments sort as 0 rather than throwing. */
export function parseVer(v: string): [number, number, number] {
  const p = v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0]
}
export function cmpVer(a: string, b: string): number {
  const x = parseVer(a), y = parseVer(b)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1
  return 0
}

/**
 * Pure: which advertised arrivals are overdue or impossible?
 *
 * `tierFirst` maps tier -> the version in which that tier becomes available. A tier absent from
 * the map is skipped by rule 2 rather than assumed present at 0.0.0 — guessing here would
 * manufacture findings, and a checker that invents them gets switched off.
 */
export function findBadTargets(
  exts: Ext[],
  currentVersion: string,
  tierFirst: Record<string, string>
): Finding[] {
  const out: Finding[] = []
  for (const e of exts) {
    if (e.status !== 'coming-soon' || !e.targetVersion) continue

    if (cmpVer(e.targetVersion, currentVersion) <= 0) {
      out.push({
        rule: 'overdue',
        id: e.id,
        detail: `advertises ${e.targetVersion} but the product is already at ${currentVersion}, and it is still coming-soon`,
      })
    }

    const first = tierFirst[e.minimumTier]
    if (first && cmpVer(first, e.targetVersion) > 0) {
      out.push({
        rule: 'impossible',
        id: e.id,
        detail: `advertises ${e.targetVersion} but its tier '${e.minimumTier}' does not exist until v${first}`,
      })
    }
  }
  return out
}

// ── Corpus ───────────────────────────────────────────────────────────────────────────────────
const TIERS_FIXTURE = { free: '1.0.0', solo: '1.0.0', team: '2.2.0', fabrick: '2.4.0' }

const MUST_CATCH: [string, Ext, string][] = [
  ['the real dns-fabrick defect',
    { id: 'dns-fabrick', minimumTier: 'fabrick', status: 'coming-soon', targetVersion: 'v1.1.0' }, '1.0.5'],
  ['team ext targeted before team exists',
    { id: 'x', minimumTier: 'team', status: 'coming-soon', targetVersion: 'v2.1.0' }, '1.0.5'],
  ['overdue — target already shipped',
    { id: 'y', minimumTier: 'free', status: 'coming-soon', targetVersion: 'v1.0.0' }, '1.0.5'],
  ['overdue — target equals current',
    { id: 'z', minimumTier: 'free', status: 'coming-soon', targetVersion: 'v1.0.5' }, '1.0.5'],
]

const MUST_IGNORE: [string, Ext, string][] = [
  ['fabrick ext at its own tier version',
    { id: 'a', minimumTier: 'fabrick', status: 'coming-soon', targetVersion: 'v2.4.0' }, '1.0.5'],
  ['fabrick ext after its tier version',
    { id: 'b', minimumTier: 'fabrick', status: 'coming-soon', targetVersion: 'v3.0.0' }, '1.0.5'],
  ['future target, tier already exists',
    { id: 'c', minimumTier: 'solo', status: 'coming-soon', targetVersion: 'v2.0.0' }, '1.0.5'],
  // An AVAILABLE extension is not making a promise — a shipped thing whose target is in the past
  // is exactly what shipping looks like, and flagging it would fire on every delivered feature.
  ['available ext with a past target',
    { id: 'd', minimumTier: 'solo', status: 'available', targetVersion: 'v1.0.0' }, '1.0.5'],
  ['coming-soon with no target at all',
    { id: 'e', minimumTier: 'solo', status: 'coming-soon' }, '1.0.5'],
  ['unknown tier is skipped, not guessed',
    { id: 'f', minimumTier: 'mystery', status: 'coming-soon', targetVersion: 'v1.1.0' }, '1.0.5'],
]

function selfTest(): string[] {
  const fails: string[] = []
  for (const [name, ext, cur] of MUST_CATCH) {
    if (findBadTargets([ext], cur, TIERS_FIXTURE).length === 0) fails.push(`MUST CATCH but did not: ${name}`)
  }
  for (const [name, ext, cur] of MUST_IGNORE) {
    const got = findBadTargets([ext], cur, TIERS_FIXTURE)
    if (got.length) fails.push(`MUST IGNORE but flagged: ${name} -> ${JSON.stringify(got)}`)
  }
  // Version comparison must be numeric, not lexicographic: "v2.10.0" > "v2.9.0".
  if (cmpVer('v2.10.0', 'v2.9.0') <= 0) fails.push('cmpVer compares lexicographically')
  return fails
}

/**
 * Extensions are declared as object literals; parse the fields we need.
 *
 * Read from **backend/src/plugins.ts**, the product registry — NOT src/stores/app.ts, which holds
 * the demo copy. The first version of this auditor read the demo and would therefore have passed
 * while the product itself advertised an impossible date. audit:demo-plugin-parity keeps the two
 * in step, so checking the authority is sufficient and checking the copy is not.
 */
function parseExtensions(src: string): Ext[] {
  const out: Ext[] = []
  for (const m of src.matchAll(/\{\s*id:\s*'([a-z0-9-]+)'[^}]*?\}/g)) {
    const body = m[0]
    const tier = /minimumTier:\s*TIERS\.([A-Z]+)/.exec(body)?.[1]?.toLowerCase()
    const status = /status:\s*'([a-z-]+)'/.exec(body)?.[1]
    const target = /targetVersion:\s*'([^']+)'/.exec(body)?.[1]
    if (!tier || !status) continue
    out.push({ id: m[1], minimumTier: tier, status, targetVersion: target })
  }
  return out
}

function main(): number {
  console.log(`\n  ${BOLD}Extension Targets${OFF}`)
  console.log(`  ${DIM}An advertised arrival must be possible, and must not pass${OFF}\n`)

  const fails = selfTest()
  if (fails.length) {
    console.error(`${RED}✗ SELF-TEST FAILED — refusing to scan${OFF}`)
    for (const f of fails) console.error(`    ${f}`)
    return 1
  }
  console.log(`  ${GREEN}✓${OFF} self-test: ${MUST_CATCH.length} catch + ${MUST_IGNORE.length} ignore cases`)
  console.log(`  auditor-contract: catch=${MUST_CATCH.length} ignore=${MUST_IGNORE.length}`)

  const matrix = JSON.parse(readFileSync(join(PKG, 'tier-matrix.json'), 'utf-8'))
  const delivery = JSON.parse(readFileSync(join(REPO, 'forge', 'DELIVERY.json'), 'utf-8'))
  const known = new Set<string>(delivery.versions.map((v: { version: string }) => v.version))

  // Cross-reference: every declared tier version must be a real release. This is what stops the
  // block aging into the same stale state the prose was in.
  const tierFirst: Record<string, string> = {}
  const dangling: string[] = []
  for (const [tier, cfg] of Object.entries(matrix.tiers ?? {})) {
    if (tier.startsWith('$')) continue
    const fv = (cfg as { firstVersion?: string }).firstVersion
    if (!fv) continue
    if (!known.has(fv)) dangling.push(`tier '${tier}' firstVersion ${fv} is not a release in forge/DELIVERY.json`)
    tierFirst[tier] = fv
  }

  const version = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf-8')).version as string
  const exts = parseExtensions(readFileSync(join(PKG, 'backend', 'src', 'plugins.ts'), 'utf-8'))
  if (exts.length === 0) {
    console.log(`${RED}${BOLD}RESULT: FAIL${OFF} — parsed 0 extensions; the parser has broken, not the data.`)
    return 1
  }

  const found = findBadTargets(exts, version, tierFirst)

  if (dangling.length || found.length) {
    for (const d of dangling) console.log(`${RED}  ✗ [tiers] ${d}${OFF}`)
    for (const f of found) console.log(`${RED}  ✗ [${f.rule}] ${f.id}${OFF} — ${f.detail}`)
    console.log(`\n${RED}${BOLD}RESULT: FAIL${OFF} — ${dangling.length + found.length} problem(s).`)
    console.log('  An advertised targetVersion is a promise shown to users. Either build it,')
    console.log('  or move the target to a release it can actually arrive in.')
    return 1
  }

  const soon = exts.filter(e => e.status === 'coming-soon').length
  console.log(
    `\n${GREEN}${BOLD}RESULT: PASS${OFF} — ${exts.length} extension(s), ${soon} coming-soon, ` +
      `all targets reachable (product at v${version})\n`
  )
  return 0
}

process.exit(main())
