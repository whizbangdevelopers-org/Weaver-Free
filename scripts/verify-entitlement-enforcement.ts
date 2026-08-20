// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:entitlement-enforcement — a signed licence field is either enforced or a written decision.
 *
 * `quantity` sits in the signed payload of every key Weaver issues. The Stripe path populates it
 * from what the customer bought, the verifier returns it, and **no consumer in Weaver reads it**.
 * The per-node term is therefore cryptographically signed and functionally unenforced: a signed
 * three-node Fabrick key deploys to thirty nodes and nothing observes the difference.
 *
 * The upstream library predicted this exactly, in a docstring on that field: *"A product that
 * ignores this field has an unenforced licence term, and that is the product's bug."* It was right,
 * and being right in a comment changed nothing — nothing read the comment either.
 *
 * So this auditor makes the seam's consumer side explicit. Every field of `LicenseResult` must
 * appear in `scripts/baselines/entitlement-enforcement.json`, marked either:
 *
 *   enforced   — with `enforcedBy` naming where. The claim is then checkable by a reader.
 *   unenforced — with a reason and a `reviewBy`. Some fields SHOULD be unenforced (`customerId` is
 *                traceability, `version` belongs to the format), and the point is that saying so
 *                is a decision someone made rather than a question nobody asked.
 *
 * It fails on an unregistered field, an incomplete row, an expired review, and a stale row. The
 * first is the one that matters most: a NEW field cannot be added to the signed payload without
 * stating whether it binds anything.
 *
 * The `reviewBy` on `quantity` is deliberately before the production key ceremony (SEC-022, v1.3).
 * Issued keys encode these values permanently, so an unenforced field settled after the first key
 * is minted means reissuing every key sold before the decision.
 *
 * Usage:
 *   npx tsx scripts/verify-entitlement-enforcement.ts
 *   npx tsx scripts/verify-entitlement-enforcement.ts --self-test
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = resolve(HERE, '..')
const VERIFIER = join(PKG, 'backend/src/entitlement/verify/verifier.ts')
const REGISTRY = join(HERE, 'baselines/entitlement-enforcement.json')

const RED = '\x1b[31m'; const GREEN = '\x1b[32m'; const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'; const YELLOW = '\x1b[33m'; const RESET = '\x1b[0m'

interface Row {
  status?: 'enforced' | 'unenforced'
  enforcedBy?: string
  reason?: string
  reviewBy?: string
}

/**
 * Read the field names off the `LicenseResult` interface — the shape the verifier hands the
 * product. Parsed from source rather than listed here on purpose: a hand-kept list is a second
 * copy that drifts, and drifting away from the payload is the whole failure being guarded.
 */
export function extractFields(src: string): string[] {
  const m = src.match(/export interface LicenseResult<[^>]*>\s*\{([\s\S]*?)\n\}/)
  if (!m) return []
  const body = m[1]!
  const fields: string[] = []
  for (const line of body.split('\n')) {
    // Skip comments and doc blocks; take `name: type` and `name?: type` at one level of indent.
    const t = line.trim()
    if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
    const f = t.match(/^([A-Za-z_$][\w$]*)\??\s*:/)
    if (f) fields.push(f[1]!)
  }
  return fields
}

export function isExpired(reviewBy: string | undefined, today: Date): boolean {
  if (!reviewBy) return true
  const d = new Date(`${reviewBy}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return true
  return d.getTime() < Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`)
}

export function validateRow(row: Row | undefined): string[] {
  if (!row) return ['not registered — state whether it is enforced, and by what']
  const problems: string[] = []
  if (row.status !== 'enforced' && row.status !== 'unenforced') {
    problems.push("status must be 'enforced' or 'unenforced'")
    return problems
  }
  if (row.status === 'enforced') {
    if (!row.enforcedBy || row.enforcedBy.trim().length < 15) {
      problems.push('enforced requires enforcedBy naming where it is enforced')
    }
  } else {
    if (!row.reason || row.reason.trim().length < 25) {
      problems.push('unenforced requires a reason — an unexplained one is an oversight wearing a label')
    }
    if (!row.reviewBy) problems.push('unenforced requires a reviewBy')
  }
  return problems
}

// --------------------------------------------------------------------------------------------
// Self-test
// --------------------------------------------------------------------------------------------

const IFACE = `
export interface LicenseResult<TTier extends string> {
  tier: TTier
  expiry: Date | null
  /** doc comment, not a field */
  graceMode: boolean
  // a line comment
  quantity: number | null
  optional?: string
}
`

const EXTRACT_CATCH: [string, string, string[]][] = [
  ['every declared field', IFACE, ['tier', 'expiry', 'graceMode', 'quantity', 'optional']],
]

const ROW_CATCH: [string, Row | undefined][] = [
  ['an absent row', undefined],
  ['no status', { reason: 'a perfectly adequate justification goes here', reviewBy: '2030-01-01' }],
  ['enforced with no enforcedBy', { status: 'enforced' }],
  ['enforced with a token enforcedBy', { status: 'enforced', enforcedBy: 'yes' }],
  ['unenforced with no reason', { status: 'unenforced', reviewBy: '2030-01-01' }],
  ['unenforced with a placeholder reason', { status: 'unenforced', reason: 'n/a', reviewBy: '2030-01-01' }],
  ['unenforced with no reviewBy', { status: 'unenforced', reason: 'a perfectly adequate justification goes here' }],
]
const ROW_IGNORE: [string, Row][] = [
  ['a complete enforced row', { status: 'enforced', enforcedBy: 'requireTier() in backend/src/license.ts' }],
  ['a complete unenforced row', { status: 'unenforced', reason: 'traceability only; it grants nothing so there is nothing to enforce', reviewBy: '2030-01-01' }],
]

const EXPIRY_CATCH: [string, string | undefined][] = [
  ['a past date', '2020-01-01'], ['an unparseable date', 'soon'], ['no date', undefined],
]
const EXPIRY_IGNORE: [string, string][] = [['today', '2026-08-20'], ['a future date', '2030-01-01']]

function selfTest(): boolean {
  const failures: string[] = []
  for (const [name, src, want] of EXTRACT_CATCH) {
    const got = extractFields(src)
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      failures.push(`CATCH mis-extracted: ${name}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`)
    }
  }
  // A source with no LicenseResult must yield nothing rather than throwing — but the live run
  // treats an empty extraction as fatal, so this cannot silently pass over a moved interface.
  if (extractFields('export const x = 1').length !== 0) failures.push('IGNORE wrongly extracted from unrelated source')

  for (const [name, row] of ROW_CATCH) {
    if (validateRow(row).length === 0) failures.push(`CATCH missed (row): ${name}`)
  }
  for (const [name, row] of ROW_IGNORE) {
    const p = validateRow(row)
    if (p.length > 0) failures.push(`IGNORE wrongly rejected (row): ${name} — ${p.join('; ')}`)
  }
  const today = new Date('2026-08-20')
  for (const [name, d] of EXPIRY_CATCH) if (!isExpired(d, today)) failures.push(`CATCH missed (expiry): ${name}`)
  for (const [name, d] of EXPIRY_IGNORE) if (isExpired(d, today)) failures.push(`IGNORE wrongly expired: ${name}`)

  const c = EXTRACT_CATCH.length + ROW_CATCH.length + EXPIRY_CATCH.length
  const i = 1 + ROW_IGNORE.length + EXPIRY_IGNORE.length
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

  console.log(`${BOLD}Entitlement Enforcement${RESET}`)
  console.log(`${DIM}every signed licence field is enforced, or a written decision not to be${RESET}\n`)

  if (!selfTest()) {
    console.error(`\n${RED}${BOLD}RESULT: FAIL${RESET} — refusing to scan on a failed self-test`)
    process.exit(1)
  }
  if (selfTestOnly) {
    console.log(`\n${GREEN}${BOLD}SELF-TEST PASSED${RESET}`)
    return
  }

  if (!existsSync(VERIFIER)) {
    console.error(`${RED}✗${RESET} verifier not found at ${VERIFIER} — refusing to report over an empty payload`)
    process.exit(1)
  }
  const fields = extractFields(readFileSync(VERIFIER, 'utf-8'))
  if (fields.length === 0) {
    console.error(
      `${RED}✗${RESET} no fields extracted from LicenseResult.\n` +
      `${DIM}  The interface moved or changed shape. Refusing to report: an empty payload would pass\n` +
      `  this auditor silently, which is the exact failure it exists to prevent.${RESET}`,
    )
    process.exit(1)
  }

  const registry = JSON.parse(readFileSync(REGISTRY, 'utf-8')) as { fields: Record<string, Row> }
  const today = new Date()
  const problems: string[] = []

  for (const field of fields) {
    const row = registry.fields?.[field]
    const issues = validateRow(row)
    if (issues.length > 0) {
      problems.push(`\`${field}\` — ${issues.join('; ')}`)
      continue
    }
    if (row!.status === 'unenforced' && isExpired(row!.reviewBy, today)) {
      problems.push(
        `\`${field}\` — unenforced, and the review lapsed on ${row!.reviewBy}\n` +
        `      ${DIM}${row!.reason}${RESET}`,
      )
    }
  }
  for (const key of Object.keys(registry.fields ?? {})) {
    if (!fields.includes(key)) {
      problems.push(`stale row \`${key}\` — no longer a field of the signed payload. Delete it.`)
    }
  }

  const enforced = fields.filter(f => registry.fields?.[f]?.status === 'enforced').length
  console.log(`${DIM}  ${fields.length} signed field(s) · ${enforced} enforced · ${fields.length - enforced} deliberately not${RESET}`)

  const unenforced = fields.filter(f => registry.fields?.[f]?.status === 'unenforced')
  if (unenforced.length > 0 && problems.length === 0) {
    console.log(`${YELLOW}  unenforced by decision: ${unenforced.join(', ')}${RESET}`)
    console.log(`${DIM}  Settle these before the production key ceremony — issued keys encode them permanently.${RESET}`)
  }

  if (problems.length > 0) {
    console.error('')
    for (const p of problems) console.error(`  ${RED}✗${RESET} ${p}`)
    console.error(`\n${RED}${BOLD}RESULT: FAIL${RESET} — ${problems.length} signed field(s) without a current decision`)
    process.exit(1)
  }

  console.log(`\n${GREEN}${BOLD}RESULT: PASS${RESET} — every signed licence field carries a current decision`)
}

main()
