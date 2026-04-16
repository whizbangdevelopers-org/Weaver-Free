// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-tier-parity.ts — Static analysis for tier matrix ↔ code alignment.
 *
 * Cross-references tier-matrix.json against:
 *   - Backend routes for requireTier() gates
 *   - Frontend components for isWeaver/isFabrick guards
 *   - Orphan detection for tier gates not in the matrix
 *
 * Usage:  npx tsx scripts/verify-tier-parity.ts
 * Exit:   0 = all compliant, 1 = parity issues found
 */

import { readFileSync, existsSync } from 'fs'
import { globSync } from 'glob'
import { resolve } from 'path'
import { saveReport } from './lib/save-report.js'

// ---------------------------------------------------------------------------
// ANSI colors
// ---------------------------------------------------------------------------
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TierFeature {
  id: string
  name: string
  minimumTier: 'free' | 'weaver' | 'fabrick'
  implemented: boolean
  backend: {
    files: string[]
    gate: 'requireTier' | 'fileHook' | 'none'
  }
  frontend: {
    files: string[]
    guard: 'isWeaver' | 'isFabrick' | 'none'
  }
}

interface TierMatrix {
  features: TierFeature[]
}

interface Issue {
  featureId: string
  featureName: string
  type: 'BACKEND_MISSING_GATE' | 'FRONTEND_MISSING_GUARD' | 'ORPHAN_BACKEND' | 'ORPHAN_FRONTEND'
  detail: string
  file?: string
  severity: 'error' | 'warning'
}

interface Pass {
  featureId: string
  check: string
  detail: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ROOT = resolve(import.meta.dirname, '..')

function readFile(relPath: string): string | null {
  const absPath = resolve(ROOT, relPath)
  if (!existsSync(absPath)) return null
  return readFileSync(absPath, 'utf-8')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const start = Date.now()

  // Load tier matrix
  const matrixPath = resolve(ROOT, 'tier-matrix.json')
  if (!existsSync(matrixPath)) {
    console.error(`${RED}${BOLD}ERROR${RESET}: tier-matrix.json not found at ${matrixPath}`)
    process.exit(1)
  }
  const matrix: TierMatrix = JSON.parse(readFileSync(matrixPath, 'utf-8'))

  const issues: Issue[] = []
  const passes: Pass[] = []
  const skipped: { id: string; reason: string }[] = []

  // =========================================================================
  // Check 1: Backend tier gates
  // =========================================================================
  for (const feature of matrix.features) {
    if (feature.minimumTier === 'free') continue
    if (!feature.implemented) {
      skipped.push({ id: feature.id, reason: 'not implemented' })
      continue
    }
    if (feature.backend.gate === 'none' || feature.backend.files.length === 0) continue

    const expectedTier = feature.minimumTier

    for (const backendFile of feature.backend.files) {
      const content = readFile(backendFile)
      if (content === null) {
        issues.push({
          featureId: feature.id,
          featureName: feature.name,
          type: 'BACKEND_MISSING_GATE',
          detail: `Backend file "${backendFile}" not found`,
          file: backendFile,
          severity: 'error',
        })
        continue
      }

      // Check for requireTier with the expected tier name (literal or TIERS constant)
      const hasTierCall = content.includes('requireTier')
      // Map string value → constant key. String 'weaver' is gated by TIERS.SOLO (renamed 2026-04-15).
      const tierConstantKey = expectedTier === 'weaver' ? 'SOLO' : expectedTier.toUpperCase()
      const hasTierName = content.includes(`'${expectedTier}'`)
        || content.includes(`"${expectedTier}"`)
        || content.includes(`TIERS.${tierConstantKey}`)

      if (hasTierCall && hasTierName) {
        passes.push({
          featureId: feature.id,
          check: 'backend-gate',
          detail: `${backendFile} has requireTier('${expectedTier}')`,
        })
      } else {
        issues.push({
          featureId: feature.id,
          featureName: feature.name,
          type: 'BACKEND_MISSING_GATE',
          detail: `${backendFile} should have requireTier('${expectedTier}') but ${!hasTierCall ? 'no requireTier() found' : `no '${expectedTier}' tier reference found`}`,
          file: backendFile,
          severity: 'error',
        })
      }
    }
  }

  // =========================================================================
  // Check 2: Frontend tier guards
  // =========================================================================
  for (const feature of matrix.features) {
    if (feature.minimumTier === 'free') continue
    if (!feature.implemented) continue
    if (feature.frontend.guard === 'none' || feature.frontend.files.length === 0) continue

    const expectedGuard = feature.frontend.guard

    for (const frontendFile of feature.frontend.files) {
      const content = readFile(frontendFile)
      if (content === null) {
        issues.push({
          featureId: feature.id,
          featureName: feature.name,
          type: 'FRONTEND_MISSING_GUARD',
          detail: `Frontend file "${frontendFile}" not found`,
          file: frontendFile,
          severity: 'error',
        })
        continue
      }

      if (content.includes(expectedGuard)) {
        passes.push({
          featureId: feature.id,
          check: 'frontend-guard',
          detail: `${frontendFile} references ${expectedGuard}`,
        })
      } else {
        issues.push({
          featureId: feature.id,
          featureName: feature.name,
          type: 'FRONTEND_MISSING_GUARD',
          detail: `${frontendFile} should reference "${expectedGuard}" but doesn't`,
          file: frontendFile,
          severity: 'error',
        })
      }
    }
  }

  // =========================================================================
  // Check 3: Orphan backend gates (files with requireTier not in matrix)
  // =========================================================================
  const matrixBackendFiles = new Set<string>()
  for (const feature of matrix.features) {
    for (const f of feature.backend.files) matrixBackendFiles.add(f)
  }

  const allBackendRouteFiles = globSync('backend/src/routes/**/*.ts', { cwd: ROOT })
    .filter(f => !f.endsWith('/index.ts'))

  for (const relFile of allBackendRouteFiles) {
    const content = readFile(relFile)
    if (!content || !content.includes('requireTier')) continue
    if (matrixBackendFiles.has(relFile)) continue

    issues.push({
      featureId: '-',
      featureName: 'ORPHAN',
      type: 'ORPHAN_BACKEND',
      detail: `${relFile} has requireTier() but is not referenced in tier-matrix.json`,
      file: relFile,
      severity: 'warning',
    })
  }

  // =========================================================================
  // Check 4: Orphan frontend guards (files with tier checks not in matrix)
  // =========================================================================
  const matrixFrontendFiles = new Set<string>()
  for (const feature of matrix.features) {
    for (const f of feature.frontend.files) matrixFrontendFiles.add(f)
  }

  const allVueFiles = globSync('src/**/*.vue', { cwd: ROOT })
  const tierGuardPattern = /\b(isWeaver|isFabrick)\b/

  // Demo framework components use tier guards for demo rendering, not feature gating
  const demoFrameworkFiles = new Set([
    'src/components/demo/MobilePreview.vue',
    'src/components/demo/DemoVersionFeatures.vue',
  ])

  for (const relFile of allVueFiles) {
    const content = readFile(relFile)
    if (!content || !tierGuardPattern.test(content)) continue
    if (matrixFrontendFiles.has(relFile)) continue
    if (demoFrameworkFiles.has(relFile)) continue

    // Extract which guards are used
    const guards: string[] = []
    if (content.includes('isWeaver')) guards.push('isWeaver')
    if (content.includes('isFabrick')) guards.push('isFabrick')

    issues.push({
      featureId: '-',
      featureName: 'ORPHAN',
      type: 'ORPHAN_FRONTEND',
      detail: `${relFile} uses ${guards.join(', ')} but is not referenced in tier-matrix.json`,
      file: relFile,
      severity: 'warning',
    })
  }

  // =========================================================================
  // Output
  // =========================================================================
  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')

  console.log('')
  console.log(`${BOLD}Tier Parity Report${RESET}`)
  console.log('==================')
  console.log(`Features in matrix: ${matrix.features.length}`)
  console.log(`  Free tier:       ${matrix.features.filter(f => f.minimumTier === 'free').length}`)
  console.log(`  Weaver tier:    ${matrix.features.filter(f => f.minimumTier === 'weaver').length}`)
  console.log(`  Fabrick tier: ${matrix.features.filter(f => f.minimumTier === 'fabrick').length}`)
  console.log(`  Not implemented: ${skipped.length}`)
  console.log('')

  // Passes
  if (passes.length > 0) {
    console.log(`${GREEN}${BOLD}+ VERIFIED (${passes.length}):${RESET}`)
    for (const pass of passes) {
      console.log(`  ${GREEN}[${pass.check}]${RESET} ${pass.featureId} ${DIM}— ${pass.detail}${RESET}`)
    }
    console.log('')
  }

  // Skipped
  if (skipped.length > 0) {
    console.log(`${DIM}o SKIPPED (${skipped.length}):${RESET}`)
    for (const s of skipped) {
      console.log(`  ${DIM}${s.id} — ${s.reason}${RESET}`)
    }
    console.log('')
  }

  // Warnings
  if (warnings.length > 0) {
    console.log(`${YELLOW}${BOLD}! WARNINGS (${warnings.length}):${RESET}`)
    for (const w of warnings) {
      console.log(`  ${YELLOW}[${w.type}]${RESET} ${w.detail}`)
    }
    console.log('')
  }

  // Errors
  if (errors.length > 0) {
    console.log(`${RED}${BOLD}x ERRORS (${errors.length}):${RESET}`)
    for (const e of errors) {
      console.log(`  ${RED}[${e.type}]${RESET} ${e.featureId}: ${e.detail}`)
    }
    console.log('')
  }

  // Save report
  const duration = Date.now() - start
  saveReport({
    reportName: 'tier-parity',
    timestamp: new Date().toISOString(),
    durationMs: duration,
    result: errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
    summary: {
      totalFeatures: matrix.features.length,
      freeFeatures: matrix.features.filter(f => f.minimumTier === 'free').length,
      weaverFeatures: matrix.features.filter(f => f.minimumTier === 'weaver').length,
      fabrickFeatures: matrix.features.filter(f => f.minimumTier === 'fabrick').length,
      notImplemented: skipped.length,
      verified: passes.length,
      errors: errors.length,
      warnings: warnings.length,
    },
    data: {
      passes: passes.map(p => ({ feature: p.featureId, check: p.check, detail: p.detail })),
      errors: errors.map(e => ({ feature: e.featureId, type: e.type, detail: e.detail, file: e.file })),
      warnings: warnings.map(w => ({ feature: w.featureId, type: w.type, detail: w.detail, file: w.file })),
      skipped,
    },
  })

  // Summary
  if (errors.length > 0) {
    console.log(`${RED}${BOLD}FAIL${RESET}: ${errors.length} tier parity error(s)`)
    process.exit(1)
  } else if (warnings.length > 0) {
    console.log(`${GREEN}${BOLD}PASS${RESET} ${DIM}(${warnings.length} warning(s) — orphan tier gates not in matrix)${RESET}`)
  } else {
    console.log(`${GREEN}${BOLD}PASS${RESET}`)
  }
}

main()
