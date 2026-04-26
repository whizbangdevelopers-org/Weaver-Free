// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Taint Analysis Auditor — runs Semgrep with custom taint rules
 *
 * Covers four taint flows the regex-based audit:sast cannot detect
 * (cross-expression data flow):
 *   no-raw-execfile-args   — user input reaching shell command args (CWE-78)
 *   no-user-input-in-path  — user input reaching filesystem paths (CWE-22)
 *   no-unvalidated-jwt-claim — unverified JWT payload in auth decisions (CWE-347)
 *   no-ssrf-in-fetch       — user input reaching outbound HTTP URLs (CWE-918)
 *
 * Requires: semgrep in PATH (`nix profile install nixpkgs#semgrep`)
 * Rules:    scripts/semgrep-rules/*.yaml
 *
 * Exit 0 = clean or semgrep not installed (warning only).
 * Exit 1 = findings detected.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'

const RULES_DIR = join(import.meta.dirname, 'semgrep-rules')
const SCAN_TARGET = join(import.meta.dirname, '..', 'backend', 'src')

const RULES = [
  'no-raw-execfile-args.yaml',
  'no-user-input-in-path.yaml',
  'no-unvalidated-jwt-claim.yaml',
  'no-ssrf-in-fetch.yaml',
]

interface SemgrepResult {
  results: Array<{
    check_id: string
    path: string
    start: { line: number }
    extra: { message: string; lines: string; severity: string }
  }>
  errors: Array<{ type: string; long_msg?: string; message?: string }>
}

function checkSemgrep(): boolean {
  const result = spawnSync('semgrep', ['--version'], { encoding: 'utf-8' })
  return result.status === 0
}

function run(): void {
  console.log('\x1b[1mTaint Analysis Audit\x1b[0m')
  console.log('\x1b[2mRuns Semgrep custom taint rules on backend/src/\x1b[0m\n')

  if (!checkSemgrep()) {
    console.log('\x1b[33m⚠ semgrep not found in PATH — skipping taint analysis\x1b[0m')
    console.log('  Install: nix profile install nixpkgs#semgrep')
    process.exit(0)
  }

  const configArgs = RULES.flatMap(r => ['--config', join(RULES_DIR, r)])
  const args = [
    'scan',
    ...configArgs,
    '--metrics=off',
    '--json',
    SCAN_TARGET,
  ]

  let rawOutput: string
  try {
    rawOutput = execFileSync('semgrep', args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number }
    // Semgrep exits 1 when findings exist — that's expected, capture stdout
    if (e.status === 1 && e.stdout) {
      rawOutput = e.stdout
    } else {
      console.error('\x1b[31m✗ semgrep scan failed\x1b[0m')
      if (e.stderr) console.error(e.stderr)
      process.exit(1)
    }
  }

  let data: SemgrepResult
  try {
    data = JSON.parse(rawOutput) as SemgrepResult
  } catch {
    console.error('\x1b[31m✗ Failed to parse semgrep JSON output\x1b[0m')
    process.exit(1)
  }

  const { results, errors } = data

  if (errors.length > 0) {
    console.error('\x1b[31m✗ Semgrep rule errors:\x1b[0m')
    for (const e of errors) {
      console.error(`  ${e.long_msg ?? e.message ?? JSON.stringify(e)}`)
    }
    process.exit(1)
  }

  if (results.length === 0) {
    console.log(`\x1b[32m✓\x1b[0m 0 taint findings — ${RULES.length} rules, clean`)
    process.exit(0)
  }

  console.error(`\x1b[31m✗ ${results.length} taint finding(s) detected:\x1b[0m\n`)
  for (const finding of results) {
    const rule = finding.check_id.replace(/^.*\./, '')
    const loc = `${finding.path}:${finding.start.line}`
    const line = finding.extra.lines.trim()
    console.error(`  \x1b[31m[${rule}]\x1b[0m ${loc}`)
    console.error(`    ${line}`)
    console.error(`    ${finding.extra.message.split('\n')[0]}`)
    console.error()
  }
  process.exit(1)
}

run()
