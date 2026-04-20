// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Pre-OpenSSF Baseline Auditor
 *
 * Locally validates the repository posture that OpenSSF Scorecard scores on
 * its weekly scan. Catches regressions BEFORE they hit the public badge.
 *
 * OpenSSF Scorecard runs on schedule; by the time a regression is visible
 * on the badge, the bad commit has already shipped. This auditor runs on
 * every push (via test:compliance) and pre-release (via test:prerelease)
 * so the posture stays green without waiting for Monday's scan.
 *
 * Checks (static, no network):
 *   1. Token-Permissions — every workflow YAML has top-level `permissions:`
 *   2. Pinned-Dependencies — all GitHub Actions `uses:` are SHA-pinned
 *   3. Dependency-Update-Tool — dependabot.yml exists at .github/
 *   4. Security-Policy — SECURITY.md exists with email + disclosure URL
 *   5. SAST — codeql.yml has push trigger (not just PR/schedule)
 *   6. License — LICENSE file at project root
 *   7. Signed-Releases — release.yml has attest-build-provenance step
 *
 * Intended invocation:
 *   npx tsx scripts/verify-openssf-baseline.ts
 *   npm run audit:openssf-baseline
 *
 * Wire into test:compliance (fast, static) — NOT test:prerelease (already
 * covered). On failure, fix the specific finding; don't suppress — each
 * finding corresponds to a Scorecard check whose score would regress on
 * next scan.
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')
const WORKFLOWS_DIR = resolve(PROJECT_ROOT, '.github', 'workflows')
const DEPENDABOT_YML = resolve(PROJECT_ROOT, '.github', 'dependabot.yml')
const SECURITY_MD = resolve(CODE_ROOT, 'SECURITY.md')
// LICENSE lives in code/ (flattens to Free repo root at sync time);
// project-root LICENSE fallback is for historical Dev-side placement.
const LICENSE_FILE_CODE = resolve(CODE_ROOT, 'LICENSE')
const LICENSE_FILE_ROOT = resolve(PROJECT_ROOT, 'LICENSE')
const RELEASE_WORKFLOW = resolve(WORKFLOWS_DIR, 'release.yml')
const CODEQL_WORKFLOW = resolve(WORKFLOWS_DIR, 'codeql.yml')

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

let failures = 0
let warnings = 0

function pass(name: string, detail: string): void {
  console.log(`  ${GREEN}\u2713${RESET} ${name} ${DIM}— ${detail}${RESET}`)
}
function fail(name: string, detail: string): void {
  failures++
  console.log(`  ${RED}\u2717${RESET} ${name}`)
  console.log(`    ${DIM}${detail}${RESET}`)
}
function warn(name: string, detail: string): void {
  warnings++
  console.log(`  ${YELLOW}\u26A0${RESET} ${name}`)
  console.log(`    ${DIM}${detail}${RESET}`)
}

function workflowFiles(): string[] {
  if (!existsSync(WORKFLOWS_DIR)) return []
  return readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => join(WORKFLOWS_DIR, f))
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkTokenPermissions(): void {
  const missing: string[] = []
  for (const wf of workflowFiles()) {
    const content = readFileSync(wf, 'utf-8')
    // Strip comments first; look for ^permissions: at workflow root
    const withoutComments = content
      .split('\n')
      .map((l) => l.replace(/#.*$/, ''))
      .join('\n')
    // Top-level permissions must appear at column 0
    if (!/^permissions:/m.test(withoutComments)) {
      missing.push(wf.replace(PROJECT_ROOT + '/', ''))
    }
  }
  if (missing.length === 0) {
    pass('Token-Permissions', `all ${workflowFiles().length} workflow(s) declare top-level permissions`)
  } else {
    fail(
      'Token-Permissions',
      `${missing.length} workflow(s) missing top-level \`permissions:\` — Scorecard will score Token-Permissions 0/10:\n     ${missing.join('\n     ')}`
    )
  }
}

function checkPinnedDependencies(): void {
  const unpinned: string[] = []
  const shaRe = /^[0-9a-f]{40}$/i
  for (const wf of workflowFiles()) {
    const content = readFileSync(wf, 'utf-8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*uses:\s*([^\s#]+)/)
      if (!m) continue
      const spec = m[1]
      // Local actions (./path) are fine
      if (spec.startsWith('./') || spec.startsWith('docker://')) continue
      const atIdx = spec.lastIndexOf('@')
      if (atIdx === -1) {
        unpinned.push(`${wf.replace(PROJECT_ROOT + '/', '')}:${i + 1} — no version specifier: ${spec}`)
        continue
      }
      const ref = spec.slice(atIdx + 1)
      if (!shaRe.test(ref)) {
        unpinned.push(`${wf.replace(PROJECT_ROOT + '/', '')}:${i + 1} — ${spec} (uses tag/branch, not SHA)`)
      }
    }
  }
  if (unpinned.length === 0) {
    pass('Pinned-Dependencies', 'all GitHub Actions `uses:` are SHA-pinned')
  } else {
    fail(
      'Pinned-Dependencies',
      `${unpinned.length} unpinned action reference(s) — Scorecard Pinned-Dependencies will score < 10:\n     ${unpinned.slice(0, 10).join('\n     ')}${unpinned.length > 10 ? `\n     ... and ${unpinned.length - 10} more` : ''}`
    )
  }
}

function checkDependencyUpdateTool(): void {
  if (!existsSync(DEPENDABOT_YML)) {
    fail('Dependency-Update-Tool', `.github/dependabot.yml missing — Scorecard scores this 0/10. Add a Dependabot config.`)
    return
  }
  pass('Dependency-Update-Tool', '.github/dependabot.yml present')
}

function checkSecurityPolicy(): void {
  if (!existsSync(SECURITY_MD)) {
    fail('Security-Policy', 'SECURITY.md missing')
    return
  }
  const content = readFileSync(SECURITY_MD, 'utf-8')
  const hasEmail = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(content)
  const hasUrl = /https?:\/\//.test(content)
  const hasDisclosureKeyword = /vulnerabilit|disclosure|report/i.test(content)
  const missing: string[] = []
  if (!hasEmail) missing.push('no clear-text email address')
  if (!hasUrl) missing.push('no http(s) URL')
  if (!hasDisclosureKeyword) missing.push('no "vulnerability/disclosure/report" keywords')
  if (missing.length > 0) {
    fail('Security-Policy', `SECURITY.md incomplete — ${missing.join(', ')}`)
  } else {
    pass('Security-Policy', 'SECURITY.md has email + URL + disclosure guidance')
  }
}

function checkSast(): void {
  if (!existsSync(CODEQL_WORKFLOW)) {
    fail('SAST', 'codeql.yml not found')
    return
  }
  const content = readFileSync(CODEQL_WORKFLOW, 'utf-8')
  // Strip comments to avoid matching text inside them
  const active = content
    .split('\n')
    .map((l) => l.replace(/#.*$/, ''))
    .join('\n')
  // Look for "push:" as a workflow trigger (under `on:` block)
  const hasPushTrigger = /^on:\s*[\s\S]*?^\s*push:\s*$/m.test(active)
  if (!hasPushTrigger) {
    fail('SAST', 'codeql.yml lacks a `push:` trigger — Scorecard caps SAST at 9/10 when CodeQL only runs on PRs/schedule')
  } else {
    pass('SAST', 'codeql.yml triggers on push')
  }
}

function checkLicense(): void {
  if (existsSync(LICENSE_FILE_CODE)) {
    pass('License', 'LICENSE present in code/ (flattens to Free repo root at sync time)')
    return
  }
  if (existsSync(LICENSE_FILE_ROOT)) {
    pass('License', 'LICENSE present at project root')
    return
  }
  fail('License', 'LICENSE file missing at code/LICENSE and project root')
}

function checkSignedReleases(): void {
  if (!existsSync(RELEASE_WORKFLOW)) {
    warn('Signed-Releases', 'release.yml not found — skipping')
    return
  }
  const content = readFileSync(RELEASE_WORKFLOW, 'utf-8')
  const hasAttest = /actions\/attest-build-provenance/.test(content)
  const hasCosign = /sigstore\/cosign-installer/.test(content) && /cosign\s+sign-blob/.test(content)

  if (!hasAttest && !hasCosign) {
    fail(
      'Signed-Releases',
      'release.yml has neither attest-build-provenance nor cosign sign-blob — Scorecard will score Signed-Releases 0/10. Add Sigstore cosign keyless signing and/or actions/attest-build-provenance.'
    )
    return
  }

  const attestContinueOnError = /attest-build-provenance[\s\S]{0,500}continue-on-error:\s*true/i.test(content)
  // Explicit exemption pragma: allows continue-on-error on attest when the
  // workflow comments document WHY (e.g., private repo on a free-plan org
  // where GitHub's attestation API returns "Feature not available"). The
  // pragma is the author asserting "I know; remove when constraint lifts."
  const hasAttestExemption =
    /#\s*openssf-baseline-allow:\s*attest-continue-on-error/i.test(content)
  if (attestContinueOnError && !hasAttestExemption) {
    fail(
      'Signed-Releases',
      'attest-build-provenance has `continue-on-error: true` without exemption pragma. Public repos on the GitHub free plan support attestations natively — remove continue-on-error so the workflow fails loud if signing breaks. If this workflow runs on a private repo where attestations fundamentally cannot succeed, add the comment `# openssf-baseline-allow: attest-continue-on-error (<reason>)` next to the flag to document the constraint.'
    )
    return
  }

  if (hasCosign && hasAttest) {
    const suffix = attestContinueOnError ? ' (attest soft-fail exempted by pragma)' : ''
    pass('Signed-Releases', `release.yml signs artifacts with cosign (keyless Sigstore) AND publishes build-provenance attestations${suffix}`)
  } else if (hasCosign) {
    pass('Signed-Releases', 'release.yml signs artifacts with cosign (keyless Sigstore)')
  } else {
    const suffix = attestContinueOnError ? ' (attest soft-fail exempted by pragma)' : ' (no continue-on-error)'
    pass('Signed-Releases', `release.yml publishes build-provenance attestations${suffix}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log(`${BOLD}Pre-OpenSSF Scorecard Baseline${RESET}`)
  console.log(`${DIM}Static, no-network checks that catch regressions before Scorecard's weekly scan${RESET}`)
  console.log()

  checkTokenPermissions()
  checkPinnedDependencies()
  checkDependencyUpdateTool()
  checkSecurityPolicy()
  checkSast()
  checkLicense()
  checkSignedReleases()

  console.log()
  if (failures > 0) {
    console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${failures} check(s) failed, ${warnings} warning(s)`)
    process.exit(1)
  }
  if (warnings > 0) {
    console.log(`${YELLOW}${BOLD}RESULT: PASS${RESET} with ${warnings} warning(s). Scorecard may still score below maximum.`)
  } else {
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — baseline clean.`)
  }
}

main()
