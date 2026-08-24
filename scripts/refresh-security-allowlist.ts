// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Security Allowlist — Review / Refresh Tool
 *
 * Maintenance companion to scripts/audit-security.ts (the gate). This does NOT
 * gate anything and does NOT auto-edit the JSON — it reviews the dynamic
 * whitelist and reports what a human should reconsider, then the human edits
 * scripts/baselines/security-allowlist.json and commits with justification.
 *
 * Reports:
 *   • EXPIRED  — entry's reviewBy date has passed → re-justify or remove.
 *   • STALE    — the acknowledged package is no longer in the dependency tree
 *                (and isn't an auto-derive parent of one) → safe to remove.
 *   • DUE SOON — reviewBy within 30 days → heads-up.
 *
 * The pass/fail signal (unknown advisories) stays with `npm run audit:security`.
 *
 * Usage: npm run refresh:security-allowlist
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const ALLOWLIST_PATH = resolve(__dirname, 'baselines', 'security-allowlist.json')

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

interface AllowEntry {
  category: string
  reason: string
  addedAt: string
  reviewBy: string
}

const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf-8'))
const ack: Record<string, AllowEntry> = raw.acknowledged ?? {}

const today = new Date().toISOString().slice(0, 10)
const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

// Is `pkg` present anywhere in the frontend or backend dependency tree?
function inTree(pkg: string): boolean {
  for (const dir of [ROOT, resolve(ROOT, 'backend')]) {
    try {
      const out = execSync(`npm ls ${pkg} --all --json 2>/dev/null`, {
        cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
      })
      if (JSON.stringify(JSON.parse(out)).includes(`"${pkg}"`)) return true
    } catch (err) {
      const out = (err as { stdout?: string }).stdout
      if (out && out.includes(`"${pkg}"`)) return true
    }
  }
  return false
}

console.log('Security Allowlist Review')
console.log('=========================')
console.log(`${DIM}source: scripts/baselines/security-allowlist.json · today: ${today}${RESET}\n`)

const expired: string[] = []
const dueSoon: string[] = []
const stale: string[] = []

for (const [pkg, entry] of Object.entries(ack)) {
  if (entry.reviewBy < today) expired.push(pkg)
  else if (entry.reviewBy < soon) dueSoon.push(pkg)
  if (!inTree(pkg)) stale.push(pkg)
}

if (expired.length) {
  console.log(`${RED}EXPIRED (reviewBy passed — re-justify or remove):${RESET}`)
  for (const p of expired) console.log(`  ✗ ${p} — reviewBy ${ack[p].reviewBy} [${ack[p].category}]`)
  console.log('')
}
if (stale.length) {
  console.log(`${YELLOW}STALE (package no longer in the dependency tree — safe to remove):${RESET}`)
  for (const p of stale) console.log(`  ○ ${p} [${ack[p].category}]`)
  console.log('')
}
if (dueSoon.length) {
  console.log(`${YELLOW}DUE SOON (reviewBy within 30 days):${RESET}`)
  for (const p of dueSoon) console.log(`  · ${p} — reviewBy ${ack[p].reviewBy}`)
  console.log('')
}

if (!expired.length && !stale.length && !dueSoon.length) {
  console.log(`${GREEN}✓ All ${Object.keys(ack).length} allowlist entries are current, in-tree, and not due for review.${RESET}`)
} else {
  console.log(`${DIM}${Object.keys(ack).length} entries total · ${expired.length} expired · ${stale.length} stale · ${dueSoon.length} due soon.${RESET}`)
  console.log(`${DIM}Edit scripts/baselines/security-allowlist.json and commit. Run \`npm run audit:security\` for the live pass/fail.${RESET}`)
}

// Review tool — informational only, never fails CI.
process.exit(0)
