// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Security Audit with Package-Level Blocked List
 *
 * Runs `npm audit` on frontend and backend, filters out advisories for
 * packages that are in the Dependabot blocked list (tracked in #39).
 * Fails only if unknown high/critical vulnerabilities are found.
 *
 * The blocked list is maintained at the PACKAGE level, not the advisory
 * level. When a new GHSA appears for an already-blocked package (e.g.,
 * fastify), it's automatically filtered — no manual update needed.
 *
 * Usage:
 *   npx tsx scripts/audit-security.ts
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// ANSI Colors
// ---------------------------------------------------------------------------

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

// ---------------------------------------------------------------------------
// Blocked Packages
//
// Packages whose major upgrades are deferred. Tracked in GitHub issue #39
// (Dependabot PR Tracker). ALL advisories for these packages (and their
// known transitive dependents) are automatically filtered.
//
// Sync this list with the QUASAR_BLOCKED and FASTIFY_BLOCKED arrays in
// .github/workflows/dependabot-labeler.yml.
//
// When a package is unblocked (e.g., Quasar supports Vite 7), remove it
// from BOTH this list and the labeler workflow.
// ---------------------------------------------------------------------------

const BLOCKED_PACKAGES: Record<string, string> = {
  // Quasar peer deps / build chain — blocked until Quasar supports next major
  vite: 'blocked-by-quasar',
  vue: 'blocked-by-quasar',
  'vue-router': 'blocked-by-quasar',
  pinia: 'blocked-by-quasar',
  '@vitejs/plugin-vue': 'blocked-by-quasar',
  typescript: 'blocked-by-quasar',
  eslint: 'blocked-by-quasar',

  // Fastify ecosystem — v5 breaking API changes, deferred post-v1.0
  fastify: 'blocked-by-fastify (deferred post-v1.0)',
  '@fastify/websocket': 'blocked-by-fastify',
  '@fastify/cors': 'blocked-by-fastify',
  '@fastify/static': 'blocked-by-fastify',
  '@fastify/rate-limit': 'blocked-by-fastify',
  '@fastify/helmet': 'blocked-by-fastify',
}

// Transitive packages that are only vulnerable because a blocked parent
// pulls them in. Maps transitive → blocked parent(s).
const BLOCKED_TRANSITIVES: Record<string, string> = {
  ajv: 'transitive via eslint',
  esbuild: 'transitive via vite',
  minimatch: 'transitive via eslint + @fastify/static',
  glob: 'transitive via @fastify/static',
  'fastify-type-provider-zod': 'transitive via fastify',
  '@eslint/eslintrc': 'transitive via eslint',
  '@humanwhocodes/config-array': 'transitive via eslint',
  '@typescript-eslint/eslint-plugin': 'transitive via eslint',
  '@typescript-eslint/parser': 'transitive via eslint',
  '@typescript-eslint/type-utils': 'transitive via eslint',
  '@typescript-eslint/utils': 'transitive via eslint',
  '@typescript-eslint/typescript-estree': 'transitive via eslint',
  'eslint-plugin-vue': 'transitive via eslint',
  'file-entry-cache': 'transitive via eslint',
  'flat-cache': 'transitive via eslint',
  flatted: 'transitive via eslint + @vitest/ui (file-entry-cache → flat-cache → flatted)',
  'serialize-javascript': 'transitive via @quasar/app-vite + workbox-build',
  lodash: 'transitive via @quasar/app-vite (archiver) + workbox-build — build-time only, not in production bundle',
  undici: 'transitive via vitest → jsdom (test-only, not in production bundle)',
}

function isBlocked(packageName: string): string | null {
  if (BLOCKED_PACKAGES[packageName]) return BLOCKED_PACKAGES[packageName]
  if (BLOCKED_TRANSITIVES[packageName]) return BLOCKED_TRANSITIVES[packageName]
  return null
}

// ---------------------------------------------------------------------------
// Audit Runner
// ---------------------------------------------------------------------------

interface AuditAdvisory {
  ghsa: string
  severity: string
  title: string
  module_name: string
  url: string
}

function runAudit(dir: string, label: string): AuditAdvisory[] {
  const advisories: AuditAdvisory[] = []

  try {
    execSync('npm audit --json 2>/dev/null', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    console.log(`  ${GREEN}✓${RESET} ${label}: no vulnerabilities`)
    return advisories
  } catch (err: unknown) {
    const error = err as { stdout?: string; status?: number }
    if (!error.stdout) {
      console.log(`  ${RED}✗${RESET} ${label}: audit command failed`)
      return advisories
    }

    try {
      const json = JSON.parse(error.stdout)

      if (json.vulnerabilities) {
        for (const [name, vuln] of Object.entries(json.vulnerabilities)) {
          const v = vuln as { severity: string; via: unknown[] }
          if (v.severity !== 'high' && v.severity !== 'critical') continue

          for (const via of v.via) {
            if (typeof via === 'object' && via !== null) {
              const advisory = via as { url?: string; title?: string }
              const ghsaMatch = advisory.url?.match(/GHSA-[a-z0-9-]+/)
              if (ghsaMatch) {
                advisories.push({
                  ghsa: ghsaMatch[0],
                  severity: v.severity,
                  title: advisory.title || name,
                  module_name: name,
                  url: advisory.url || '',
                })
              }
            }
          }
        }
      }
    } catch {
      console.log(`  ${YELLOW}!${RESET} ${label}: failed to parse audit JSON`)
    }

    return advisories
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('Security Audit Report')
console.log('=====================')
console.log('')
console.log('SCANNING:')

const frontendAdvisories = runAudit(ROOT, 'Frontend (root)')
const backendAdvisories = runAudit(resolve(ROOT, 'backend'), 'Backend')

const allAdvisories = [...frontendAdvisories, ...backendAdvisories]

// Deduplicate by GHSA ID
const unique = new Map<string, AuditAdvisory>()
for (const a of allAdvisories) {
  if (!unique.has(a.ghsa)) {
    unique.set(a.ghsa, a)
  }
}

const known: AuditAdvisory[] = []
const unknown: AuditAdvisory[] = []

for (const [, advisory] of unique) {
  const reason = isBlocked(advisory.module_name)
  if (reason) {
    known.push(advisory)
  } else {
    unknown.push(advisory)
  }
}

console.log('')
console.log('HIGH/CRITICAL ADVISORIES:')

if (known.length > 0) {
  console.log('')
  console.log(`  ${DIM}Known-blocked (tracked in #39):${RESET}`)
  for (const a of known) {
    const reason = isBlocked(a.module_name)
    console.log(`  ${DIM}○${RESET} ${a.ghsa} ${a.module_name} — ${reason}`)
  }
}

if (unknown.length > 0) {
  console.log('')
  console.log(`  ${RED}Unknown (action required):${RESET}`)
  for (const a of unknown) {
    console.log(`  ${RED}✗${RESET} ${a.ghsa} ${a.module_name} (${a.severity}) — ${a.title}`)
    console.log(`    ${a.url}`)
  }
}

if (known.length === 0 && unknown.length === 0) {
  console.log(`  ${GREEN}✓${RESET} No high/critical advisories`)
}

console.log('')

const npmPassed = unknown.length === 0

// ---------------------------------------------------------------------------
// Security Baselines (NIST 800-63B / OWASP ASVS 4.0)
//
// Reads source files and verifies security parameters meet the thresholds
// defined in docs/security/SECURITY-BASELINES.md.
// ---------------------------------------------------------------------------

interface BaselineCheck {
  label: string
  passed: boolean
  detail?: string
}

const baselineResults: BaselineCheck[] = []

function readSource(relativePath: string): string {
  try {
    return readFileSync(resolve(ROOT, relativePath), 'utf-8')
  } catch {
    return ''
  }
}

// --- auth.ts schema checks ---
const authSchemaSource = readSource('backend/src/schemas/auth.ts')

// Password min length: .min(14
const hasMinLength14 = /\.min\(14[,)]/.test(authSchemaSource)
baselineResults.push({
  label: 'Password minimum: 14 characters',
  passed: hasMinLength14,
  detail: hasMinLength14 ? undefined : 'Expected .min(14) in auth schema',
})

// Special character regex
const hasSpecialCharRegex = /\[\^A-Za-z0-9\]/.test(authSchemaSource)
baselineResults.push({
  label: 'Password complexity: special character regex',
  passed: hasSpecialCharRegex,
  detail: hasSpecialCharRegex ? undefined : 'Expected [^A-Za-z0-9] regex in auth schema',
})

// --- auth.ts service checks ---
const authServiceSource = readSource('backend/src/services/auth.ts')

// Bcrypt rounds >= 13
const bcryptMatch = authServiceSource.match(/BCRYPT_ROUNDS\s*=\s*(\d+)/)
const bcryptRounds = bcryptMatch ? parseInt(bcryptMatch[1], 10) : 0
const bcryptOk = bcryptRounds >= 13
baselineResults.push({
  label: `Bcrypt cost factor: ${bcryptRounds} (minimum 13)`,
  passed: bcryptOk,
  detail: bcryptOk ? undefined : `BCRYPT_ROUNDS is ${bcryptRounds}, should be >= 13`,
})

// Access token TTL must be '15m'
const ttlMatch = authServiceSource.match(/ACCESS_TOKEN_TTL\s*=\s*'([^']+)'/)
const accessTtl = ttlMatch ? ttlMatch[1] : 'not found'
const ttlOk = accessTtl === '15m'
baselineResults.push({
  label: `Access token TTL: ${accessTtl} (should be 15m)`,
  passed: ttlOk,
  detail: ttlOk ? undefined : `ACCESS_TOKEN_TTL is '${accessTtl}', should be '15m'`,
})

// Dummy hash for timing attack prevention
const hasDummyHash = /dummy/i.test(authServiceSource) || /DUMMY_HASH/i.test(authServiceSource)
baselineResults.push({
  label: 'Login timing: dummy hash for missing users',
  passed: hasDummyHash,
  detail: hasDummyHash ? undefined : 'No dummy hash found — missing user login returns faster than valid user',
})

// Generic error messages
const hasGenericError = /Invalid username or password/.test(authServiceSource)
baselineResults.push({
  label: 'Login error messages: generic (no user enumeration)',
  passed: hasGenericError,
  detail: hasGenericError ? undefined : 'Expected "Invalid username or password" message',
})

// --- index.ts checks ---
const indexSource = readSource('backend/src/index.ts')

// HSTS: Helmet defaults to maxAge 15552000 (180 days). We require 31536000 (1 year).
// Check if strictTransportSecurity is explicitly configured with maxAge >= 31536000.
const hstsExplicit = /(?:strictTransportSecurity|hsts)\s*:\s*\{[^}]*maxAge\s*:\s*(\d+)/s.exec(indexSource)
const hstsMaxAge = hstsExplicit ? parseInt(hstsExplicit[1], 10) : null
const hstsOk = hstsMaxAge !== null && hstsMaxAge >= 31536000
baselineResults.push({
  label: `HSTS max-age: ${hstsMaxAge ?? 'default (15552000)'} (minimum 31536000)`,
  passed: hstsOk,
  detail: hstsOk ? undefined : 'Set helmet strictTransportSecurity.maxAge to 31536000',
})

// CORS: production must not use origin: true (reflects arbitrary origins)
// Check if there's a safeguard — origin: true with credentials is risky.
// The codebase uses `corsOrigin ?? (production ? true : ...)` — flag origin: true in production.
const corsReflect = /origin:\s*true/.test(indexSource) || /corsOrigin\s*\?\?\s*.*true/.test(indexSource)
const corsHasProductionGuard = /CORS_ORIGIN must not be "\*" in production/.test(indexSource)
// origin: true reflects the request origin which is equivalent to a wildcard with credentials
const corsOk = !corsReflect
baselineResults.push({
  label: 'CORS production: explicit origin only',
  passed: corsOk,
  detail: corsOk ? undefined : 'Production CORS uses origin: true (reflects arbitrary origins). Use an explicit allowed origin.',
})

// --- auth routes checks ---
const authRoutesSource = readSource('backend/src/routes/auth.ts')

// Logout route should have an audit log call
// Match from '/logout' through the next route registration (greedy enough to capture the handler body)
const logoutSection = authRoutesSource.match(/['"]\/logout['"][\s\S]*?(?=\n\s+\/\/\s+\w+\s+\/auth\/|$)/)?.[0] ?? ''
const logoutHasAudit = /auditService/.test(logoutSection)
baselineResults.push({
  label: 'Audit logging: logout event',
  passed: logoutHasAudit,
  detail: logoutHasAudit ? undefined : 'Logout handler missing auditService.log() call',
})

// --- Print baseline results ---
console.log('SECURITY BASELINES (NIST 800-63B / OWASP ASVS 4.0)')

const baselineFailures: BaselineCheck[] = []
const baselinePasses: BaselineCheck[] = []

for (const check of baselineResults) {
  if (check.passed) {
    baselinePasses.push(check)
    console.log(`  ${GREEN}✓${RESET} ${check.label}`)
  } else {
    baselineFailures.push(check)
    console.log(`  ${RED}✗${RESET} ${check.label}`)
    if (check.detail) {
      console.log(`    ${DIM}${check.detail}${RESET}`)
    }
  }
}

console.log('')

const baselinePassed = baselineFailures.length === 0
const overallPassed = npmPassed && baselinePassed

saveReport({
  reportName: 'security-audit',
  timestamp: new Date().toISOString(),
  durationMs: 0,
  result: overallPassed ? 'pass' : 'fail',
  summary: {
    total: unique.size,
    knownBlocked: known.length,
    unknown: unknown.length,
    baselineChecks: baselineResults.length,
    baselineFailures: baselineFailures.length,
  },
  data: {
    known: known.map(a => ({ ghsa: a.ghsa, module: a.module_name, severity: a.severity, reason: isBlocked(a.module_name) })),
    unknown: unknown.map(a => ({ ghsa: a.ghsa, module: a.module_name, severity: a.severity, title: a.title, url: a.url })),
    baselineFailures: baselineFailures.map(c => ({ label: c.label, detail: c.detail })),
  },
})

if (!overallPassed) {
  const parts: string[] = []
  if (!npmPassed) {
    parts.push(`${unknown.length} unknown high/critical advisory(s)`)
  }
  if (!baselinePassed) {
    parts.push(`${baselineFailures.length} baseline failure(s)`)
  }
  console.log(`${RED}RESULT: FAIL — ${parts.join(', ')}${RESET}`)
  process.exit(1)
} else {
  const blockedMsg =
    known.length > 0 ? ` (${known.length} known-blocked, tracked in #39)` : ''
  console.log(`${GREEN}RESULT: PASS${blockedMsg}${RESET}`)
  process.exit(0)
}
