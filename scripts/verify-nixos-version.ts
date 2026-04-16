// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * NixOS Version Parity Auditor
 *
 * Reads the canonical nixpkgs version from flake.nix and verifies all
 * files that reference the NixOS version are consistent. Catches training
 * gaps, copy-paste drift, and upgrade oversights.
 *
 * Source of truth: flake.nix → nixpkgs.url → "nixos-XX.YY"
 *
 * Usage:
 *   npx tsx scripts/verify-nixos-version.ts          # Console report
 *   npx tsx scripts/verify-nixos-version.ts --json    # JSON output
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

// ANSI colors
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const JSON_MODE = process.argv.includes('--json')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Finding {
  check: string
  status: 'pass' | 'fail' | 'warn'
  detail: string
}

// ---------------------------------------------------------------------------
// Source of truth
// ---------------------------------------------------------------------------

function extractCanonicalVersion(): string | null {
  const flakePath = resolve(rootDir, 'flake.nix')
  if (!existsSync(flakePath)) return null
  const content = readFileSync(flakePath, 'utf-8')
  // Match: nixpkgs.url = "github:NixOS/nixpkgs/nixos-XX.YY";
  const match = content.match(/nixpkgs\.url\s*=\s*"github:NixOS\/nixpkgs\/nixos-(\d+\.\d+)"/)
  return match ? match[1] : null
}

// ---------------------------------------------------------------------------
// Check definitions
// ---------------------------------------------------------------------------

interface FileCheck {
  /** Relative path from code/ root */
  path: string
  /** Human-readable description */
  label: string
  /** Pattern to search for — must contain a capture group for the version */
  pattern: RegExp
  /** Whether all matches must pass (default true) */
  allMatches?: boolean
}

const FILE_CHECKS: FileCheck[] = [
  // Flake lock
  {
    path: 'flake.lock',
    label: 'flake.lock original ref',
    pattern: /"ref":\s*"nixos-(\d+\.\d+)"/,
  },
  // Distro catalog
  {
    path: 'backend/data/distro-catalog.json',
    label: 'distro-catalog.json NixOS labels',
    pattern: /"label":\s*"NixOS (\d+\.\d+)[^"]*"/g,
    allMatches: true,
  },
  {
    path: 'backend/data/distro-catalog.json',
    label: 'distro-catalog.json NixOS URLs',
    pattern: /channels\.nixos\.org\/nixos-(\d+\.\d+)\//g,
    allMatches: true,
  },
  // URL validation cache
  {
    path: 'backend/data/url-validation.json',
    label: 'url-validation.json cached URLs',
    pattern: /channels\.nixos\.org\/nixos-(\d+\.\d+)\//g,
    allMatches: true,
  },
  // Backend mock data
  {
    path: 'backend/src/services/host-info.ts',
    label: 'host-info.ts mock nixosVersion',
    pattern: /nixosVersion:\s*'(\d+\.\d+)\.\d+/,
  },
  // Frontend demo data
  {
    path: 'src/config/demo.ts',
    label: 'demo.ts template baseDistro',
    pattern: /baseDistro:\s*'NixOS (\d+\.\d+)'/g,
    allMatches: true,
  },
  // TUI mock data
  {
    path: 'tui/src/demo/mock.ts',
    label: 'TUI mock nixosVersion',
    pattern: /nixosVersion:\s*'(\d+\.\d+)'/,
  },
  // Test fixtures
  {
    path: 'tui/src/__tests__/HostDetailView.spec.tsx',
    label: 'HostDetailView test mock',
    pattern: /nixosVersion:\s*'(\d+\.\d+)'/,
  },
  {
    path: 'tui/src/__tests__/HostDetailView.spec.tsx',
    label: 'HostDetailView test assertion',
    pattern: /toContain\('(\d+\.\d+)'\)/,
  },
  {
    path: 'tui/src/__tests__/demo-mock.spec.ts',
    label: 'demo-mock test assertion',
    pattern: /toBe\('(\d+\.\d+)'\)/,
  },
  // Docs
  {
    path: 'docs/DEVELOPER-GUIDE.md',
    label: 'DEVELOPER-GUIDE API example',
    pattern: /"nixosVersion":\s*"(\d+\.\d+)\.\d+"/,
  },
  {
    path: 'docs/planning/FRESH-INSTALL-TEST-PLAN.md',
    label: 'FRESH-INSTALL-TEST-PLAN stateVersion',
    pattern: /stateVersion\s*=\s*"(\d+\.\d+)"/,
  },
]

// Files outside code/ (relative to project root, not code/)
interface ProjectFileCheck extends FileCheck {
  projectRoot: true
}

const PROJECT_FILE_CHECKS: ProjectFileCheck[] = [
  {
    path: 'business/legal/SOFTWARE-LICENSE-EVALUATION.md',
    label: 'SOFTWARE-LICENSE-EVALUATION nixpkgs ref',
    pattern: /nixos-(\d+\.\d+)/,
    projectRoot: true,
  },
  {
    path: 'research/microvm-anywhere-nix-templates.md',
    label: 'microvm-anywhere templates stateVersion',
    pattern: /stateVersion\s*=\s*"(\d+\.\d+)"/g,
    allMatches: true,
    projectRoot: true,
  },
  {
    path: 'research/MicroVM_NixOS_Reference.md',
    label: 'MicroVM reference stateVersion',
    pattern: /stateVersion\s*=\s*"(\d+\.\d+)"/g,
    allMatches: true,
    projectRoot: true,
  },
]

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function checkFile(
  canonical: string,
  check: FileCheck,
  baseDir: string,
): Finding[] {
  const findings: Finding[] = []
  const fullPath = resolve(baseDir, check.path)

  if (!existsSync(fullPath)) {
    findings.push({ check: check.label, status: 'warn', detail: `File not found: ${check.path}` })
    return findings
  }

  const content = readFileSync(fullPath, 'utf-8')

  if (check.allMatches) {
    // Check all matches of a global regex
    const regex = new RegExp(check.pattern.source, 'g')
    const matches = [...content.matchAll(regex)]
    if (matches.length === 0) {
      findings.push({ check: check.label, status: 'warn', detail: 'No version references found' })
      return findings
    }
    let allGood = true
    const staleVersions = new Set<string>()
    for (const m of matches) {
      if (m[1] !== canonical) {
        allGood = false
        staleVersions.add(m[1])
      }
    }
    if (allGood) {
      findings.push({ check: check.label, status: 'pass', detail: `${matches.length} reference(s) → ${canonical}` })
    } else {
      findings.push({
        check: check.label,
        status: 'fail',
        detail: `Found stale version(s): ${[...staleVersions].join(', ')} (expected ${canonical}) in ${check.path}`,
      })
    }
  } else {
    // Check single match
    const match = content.match(check.pattern)
    if (!match) {
      findings.push({ check: check.label, status: 'warn', detail: 'No version reference found' })
    } else if (match[1] === canonical) {
      findings.push({ check: check.label, status: 'pass', detail: `→ ${canonical}` })
    } else {
      findings.push({
        check: check.label,
        status: 'fail',
        detail: `Found ${match[1]}, expected ${canonical} in ${check.path}`,
      })
    }
  }

  return findings
}

function run(): void {
  const startTime = Date.now()
  const findings: Finding[] = []

  // 1. Extract canonical version
  const canonical = extractCanonicalVersion()
  if (!canonical) {
    findings.push({ check: 'flake.nix canonical version', status: 'fail', detail: 'Could not extract nixpkgs version from flake.nix' })
    report(findings, Date.now() - startTime)
    return
  }
  findings.push({ check: 'flake.nix canonical version', status: 'pass', detail: `nixos-${canonical}` })

  // 2. Check files in code/
  for (const check of FILE_CHECKS) {
    findings.push(...checkFile(canonical, check, rootDir))
  }

  // 3. Check files in project root (above code/)
  const projectRoot = resolve(rootDir, '..')
  for (const check of PROJECT_FILE_CHECKS) {
    findings.push(...checkFile(canonical, check, projectRoot))
  }

  report(findings, Date.now() - startTime)
}

function report(findings: Finding[], durationMs: number): void {
  const errors = findings.filter(f => f.status === 'fail').length
  const warnings = findings.filter(f => f.status === 'warn').length
  const passes = findings.filter(f => f.status === 'pass').length
  const total = findings.length
  const result = errors > 0 ? 'fail' as const : warnings > 0 ? 'warn' as const : 'pass' as const

  saveReport({
    reportName: 'verify-nixos-version',
    timestamp: new Date().toISOString(),
    durationMs,
    result,
    summary: { passed: passes, failed: errors, warned: warnings, total },
    data: { findings },
  })

  if (JSON_MODE) {
    console.log(JSON.stringify({ result, summary: { passed: passes, failed: errors, warned: warnings, total }, findings }, null, 2))
  } else {
    console.log(`\n${BOLD}NixOS Version Parity Audit${RESET}\n`)
    for (const f of findings) {
      const icon = f.status === 'pass' ? `${GREEN}✓${RESET}`
        : f.status === 'fail' ? `${RED}✗${RESET}`
        : `${YELLOW}⚠${RESET}`
      console.log(`  ${icon} ${f.check}: ${DIM}${f.detail}${RESET}`)
    }
    console.log(`\n${BOLD}Summary:${RESET} ${passes} passed, ${warnings} warned, ${errors} failed (${total} checks, ${durationMs}ms)\n`)

    if (errors > 0) {
      console.log(`${RED}${BOLD}FAIL${RESET} — NixOS version references are inconsistent with flake.nix`)
      console.log(`${DIM}Fix: update all references to match the nixpkgs version in flake.nix${RESET}\n`)
    }
  }

  process.exit(errors > 0 ? 1 : 0)
}

run()
