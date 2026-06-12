// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:decision-refs — namespaced decision-reference integrity (FORGE-1).
 *
 * After the #NNN → WVR-NNN migration, every decision reference self-identifies
 * its plan. This auditor enforces two invariants across the repo:
 *
 *   1. Resolution — every `WVR-NNN` token resolves to an existing row in
 *      MASTER-PLAN's Decisions Resolved table (catches typos / dangling refs).
 *   2. No cross-product leak — a foreign WBD decision namespace (`GAN-`, `QEP-`)
 *      inside Weaver FAILS unless whitelisted in `forge/decision-sources.yaml`.
 *      The legitimate relocation targets (`FORGE-`, `HARN-`) are whitelisted.
 *
 * Scope: only the known WBD decision prefixes are matched (WVR/GAN/QEP/FORGE/
 * HARN), so compliance-framework tokens like NIST-800 / SOC-2 / CVE-2024 are
 * never misread as decision refs. The license-key prefix `WVR-FRE`/`WVR-WVS`
 * is unaffected — those are letters after `WVR-`, never digits.
 *
 * Frozen doc snapshots (docs/vN), archives, and generated reports are excluded:
 * snapshots are immutable point-in-time records that pre-date the namespace.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, extname, relative } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')
const MASTER_PLAN = resolve(PROJECT_ROOT, 'MASTER-PLAN.md')
const MANIFEST = resolve(PROJECT_ROOT, 'forge', 'decision-sources.yaml')

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const EXT = new Set([
  '.md', '.ts', '.tsx', '.vue', '.js', '.mjs', '.cjs', '.json', '.sh', '.yaml', '.yml', '.nix', '.html',
])
const SKIP_DIR =
  /(^|\/)(node_modules|\.git|dist|build|coverage|reports|logs|playwright-report|test-results|\.quasar|\.nyc_output)(\/|$)/
const SKIP_PATH = /\/docs\/v\d+(\.\d+)*\/|\/archive\//

// Known WBD decision namespaces. Scoping to these avoids false positives on
// framework tokens (NIST-800, SOC-2, RFC-1918, CVE-2024, AES-256, …).
const KNOWN_PREFIXES = ['WVR', 'GAN', 'QEP', 'FORGE', 'HARN']
const TOKEN_RE = new RegExp(`\\b(${KNOWN_PREFIXES.join('|')})-(\\d{1,4})\\b`, 'g')

/** Minimal manifest read — own_prefix + allowed_foreign_prefixes list items. */
function loadManifest(): { ownPrefix: string; allowedForeign: Set<string> } {
  const text = readFileSync(MANIFEST, 'utf8')
  const ownPrefix = (text.match(/^own_prefix:\s*(\S+)/m)?.[1] ?? 'WVR').trim()
  const allowedForeign = new Set<string>()
  const block = text.split(/^allowed_foreign_prefixes:\s*$/m)[1] ?? ''
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*-\s*([A-Z]+)\b/)
    if (m) allowedForeign.add(m[1]!)
    else if (/^\S/.test(line) && line.trim() !== '') break // next top-level key ends the list
  }
  return { ownPrefix, allowedForeign }
}

/** Valid Weaver decision numbers — from MASTER-PLAN `| WVR-N |` rows. */
function loadValidNumbers(): Set<number> {
  const text = readFileSync(MASTER_PLAN, 'utf8')
  const valid = new Set<number>()
  for (const m of text.matchAll(/^\|\s*WVR-(\d+)\s*\|/gm)) valid.add(parseInt(m[1]!, 10))
  return valid
}

function walk(dir: string, acc: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name)
    if (SKIP_DIR.test(p)) continue
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p, acc)
    else if (EXT.has(extname(name))) acc.push(p)
  }
  return acc
}

console.log(`${BOLD}Decision Reference Integrity (FORGE-1)${RESET}`)
console.log(`${DIM}Every WVR-N token resolves to a MASTER-PLAN row; no un-whitelisted cross-product ref${RESET}`)
console.log()

const { ownPrefix, allowedForeign } = loadManifest()
const valid = loadValidNumbers()
console.log(`${DIM}own prefix: ${ownPrefix} · valid decisions: ${valid.size} · whitelisted foreign: ${[...allowedForeign].join(', ') || '(none)'}${RESET}`)

interface Issue {
  file: string
  line: number
  token: string
  reason: string
}
const dangling: Issue[] = []
const foreign: Issue[] = []

for (const file of walk(PROJECT_ROOT, [])) {
  if (SKIP_PATH.test(file)) continue
  // Don't scan this auditor (its KNOWN_PREFIXES literals would self-flag) or the manifest.
  if (file === __filename || file === MANIFEST) continue
  let content: string
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  if (!KNOWN_PREFIXES.some((p) => content.includes(p + '-'))) continue
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    TOKEN_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = TOKEN_RE.exec(lines[i]!)) !== null) {
      const prefix = m[1]!
      const num = parseInt(m[2]!, 10)
      const token = `${prefix}-${num}`
      if (prefix === ownPrefix) {
        if (!valid.has(num)) {
          dangling.push({ file: relative(PROJECT_ROOT, file), line: i + 1, token, reason: `no such Weaver decision (max ${Math.max(...valid)})` })
        }
      } else if (!allowedForeign.has(prefix)) {
        foreign.push({ file: relative(PROJECT_ROOT, file), line: i + 1, token, reason: `foreign decision namespace '${prefix}-' not whitelisted in forge/decision-sources.yaml` })
      }
    }
  }
}

let failures = 0
if (dangling.length > 0) {
  failures += dangling.length
  console.log(`\n${RED}${BOLD}DANGLING WVR- REFERENCES:${RESET} ${dangling.length}`)
  for (const d of dangling.slice(0, 30)) console.log(`  ${RED}✗${RESET} ${d.file}:${d.line} — ${d.token} (${d.reason})`)
}
if (foreign.length > 0) {
  failures += foreign.length
  console.log(`\n${RED}${BOLD}UN-WHITELISTED CROSS-PRODUCT REFERENCES:${RESET} ${foreign.length}`)
  for (const f of foreign.slice(0, 30)) console.log(`  ${RED}✗${RESET} ${f.file}:${f.line} — ${f.token} (${f.reason})`)
}

console.log()
if (failures > 0) {
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${failures} decision-reference issue(s)`)
  process.exit(1)
}
console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — all decision references resolve and namespace-check`)
