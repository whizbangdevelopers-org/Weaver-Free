// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-tui-parity.ts — TUI vs Web UI feature parity checker.
 *
 * Defines the feature matrix and checks TUI source for corresponding
 * implementations. Reports gaps between web UI and TUI.
 *
 * Usage:  npx tsx scripts/verify-tui-parity.ts
 * Exit:   0 = all compliant, 1 = parity issues found
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { saveReport } from './lib/save-report.js'

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const ROOT = resolve(import.meta.dirname, '..')
const TUI_SRC = resolve(ROOT, 'tui/src')

// ---------------------------------------------------------------------------
// Feature matrix — what the web UI has
// ---------------------------------------------------------------------------

interface Feature {
  id: string
  name: string
  tier: 'free' | 'weaver' | 'fabrick'
  /** Glob patterns in tui/src/ that prove the feature exists */
  tuiIndicators: string[]
  /** String patterns to grep for in matched files */
  codePatterns: string[]
  /** N/A in terminal context — always passes */
  notApplicable?: boolean
  /** Planned but deferred — reported as warning, does not fail check */
  deferred?: string
}

const FEATURES: Feature[] = [
  // --- Free tier ---
  { id: 'vm-list', name: 'VM list with status cards', tier: 'free',
    tuiIndicators: ['components/VmList.tsx'], codePatterns: ['VmList'] },
  { id: 'vm-detail', name: 'VM detail view', tier: 'free',
    tuiIndicators: ['components/VmDetail.tsx'], codePatterns: ['VmDetail'] },
  { id: 'vm-start-stop', name: 'Start/Stop/Restart', tier: 'free',
    tuiIndicators: ['components/VmList.tsx'], codePatterns: ['onAction'] },
  { id: 'vm-create', name: 'Create VM form', tier: 'free',
    tuiIndicators: ['components/CreateVmForm.tsx'], codePatterns: ['CreateVmForm'] },
  { id: 'vm-delete', name: 'Delete VM', tier: 'free',
    tuiIndicators: ['components/VmDetail.tsx'], codePatterns: ['onDelete'] },
  { id: 'search-filter', name: 'Search/filter VMs', tier: 'free',
    tuiIndicators: ['components/VmList.tsx'], codePatterns: ['searchQuery', 'statusFilter'] },
  { id: 'export', name: 'Export VM configs', tier: 'free',
    tuiIndicators: ['index.tsx'], codePatterns: ['--export', 'export'] },
  { id: 'websocket', name: 'WebSocket real-time updates', tier: 'free',
    tuiIndicators: ['client/ws.ts'], codePatterns: ['onVmStatus'] },
  { id: 'login', name: 'Login with credentials', tier: 'free',
    tuiIndicators: ['components/LoginPrompt.tsx'], codePatterns: ['LoginPrompt'] },
  { id: 'register', name: 'First-run registration', tier: 'free',
    tuiIndicators: ['components/RegisterPrompt.tsx'], codePatterns: ['RegisterPrompt'] },
  { id: 'help', name: 'Help view', tier: 'free',
    tuiIndicators: ['components/HelpView.tsx'], codePatterns: ['HelpView'] },
  { id: 'vm-scan', name: 'VM discovery/scan', tier: 'free',
    tuiIndicators: ['components/VmList.tsx'], codePatterns: ['onScan'] },
  { id: 'keyboard-shortcuts', name: 'Keyboard navigation', tier: 'free',
    tuiIndicators: ['components/HelpView.tsx'], codePatterns: ['KeyRow'] },
  { id: 'vm-console', name: 'VM console (simulated shell)', tier: 'free',
    tuiIndicators: ['components/VmConsole.tsx'],
    codePatterns: ['simulated', 'getCannedResponse'] },
  { id: 'provisioning-logs', name: 'Provisioning logs viewer', tier: 'free',
    tuiIndicators: ['components/VmLogs.tsx'],
    codePatterns: ['Provisioning Logs', 'getVmLogs'] },

  // --- Weaver tier ---
  { id: 'ai-agent', name: 'AI agent dialog', tier: 'weaver',
    tuiIndicators: ['components/AgentDialog.tsx'], codePatterns: ['AgentDialog'] },
  { id: 'network-topology', name: 'Network topology view', tier: 'weaver',
    tuiIndicators: ['components/weaver/NetworkView.tsx'], codePatterns: ['NetworkView'] },
  { id: 'distro-catalog', name: 'Distro catalog browser', tier: 'weaver',
    tuiIndicators: ['components/DistrosView.tsx'], codePatterns: ['DistrosView'] },
  { id: 'host-info', name: 'Host information', tier: 'weaver',
    tuiIndicators: ['components/weaver/HostDetailView.tsx'], codePatterns: ['HostDetailView'] },
  { id: 'notifications', name: 'Notification settings', tier: 'weaver',
    tuiIndicators: ['components/weaver/NotificationsView.tsx'], codePatterns: ['NotificationsView'] },
  { id: 'settings-connection', name: 'Settings: connection info + tier', tier: 'weaver',
    tuiIndicators: ['components/weaver/SettingsView.tsx'], codePatterns: ['Connection', 'Backend URL', 'Tier'] },
  { id: 'settings-ai-config', name: 'Settings: AI key configuration (BYOK input)', tier: 'weaver',
    tuiIndicators: ['components/weaver/SettingsView.tsx'], codePatterns: ['apiKeyInput', 'setApiKey'] },
  { id: 'settings-license', name: 'Settings: license detail (tier, expiry, grace)', tier: 'weaver',
    tuiIndicators: ['components/weaver/SettingsView.tsx'], codePatterns: ['License', 'tierExpiry'] },
  { id: 'settings-mode', name: 'Settings: current mode indicator', tier: 'weaver',
    tuiIndicators: ['components/weaver/SettingsView.tsx'], codePatterns: ['Current Mode', 'modeLabel'] },
  { id: 'vm-templates', name: 'VM templates', tier: 'weaver',
    tuiIndicators: ['components/weaver/TemplatesView.tsx'], codePatterns: ['TemplatesView'] },
  { id: 'theme', name: 'Theme toggle (dark/light/auto)', tier: 'free',
    tuiIndicators: [], codePatterns: [], notApplicable: true },
  { id: 'help-tooltips', name: 'Contextual help tooltips', tier: 'free',
    tuiIndicators: [], codePatterns: [], notApplicable: true },
  { id: 'pwa', name: 'PWA installable app', tier: 'free',
    tuiIndicators: [], codePatterns: [], notApplicable: true },

  // --- Fabrick tier ---
  { id: 'user-management', name: 'User management', tier: 'fabrick',
    tuiIndicators: ['components/fabrick/UsersView.tsx'], codePatterns: ['UsersView'] },
  { id: 'user-detail', name: 'User detail + quotas', tier: 'fabrick',
    tuiIndicators: ['components/fabrick/UserDetailView.tsx'], codePatterns: ['UserDetailView'] },
  { id: 'audit-log', name: 'Audit log viewer', tier: 'fabrick',
    tuiIndicators: ['components/fabrick/AuditView.tsx'], codePatterns: ['AuditView'] },
  { id: 'bulk-ops', name: 'Bulk operations (multi-select)', tier: 'fabrick',
    tuiIndicators: ['components/VmList.tsx'], codePatterns: ['bulk', 'multiSelect', 'selectedVms'],
    deferred: 'fabrick feature — planned post-v1.0' },
  { id: 'fleet-bridges', name: 'Fleet virtual bridges', tier: 'fabrick',
    tuiIndicators: ['components/fabrick/FleetBridgesView.tsx'], codePatterns: ['FleetBridgesView'] },
]

// ---------------------------------------------------------------------------
// Check logic
// ---------------------------------------------------------------------------

interface Result {
  feature: Feature
  status: 'pass' | 'fail' | 'na' | 'deferred'
  details: string
}

function checkFeature(feature: Feature): Result {
  if (feature.notApplicable) {
    return { feature, status: 'na', details: 'N/A in terminal context' }
  }
  if (feature.deferred) {
    return { feature, status: 'deferred', details: feature.deferred }
  }

  // Check if indicator files exist
  const existingFiles: string[] = []
  for (const indicator of feature.tuiIndicators) {
    const fullPath = resolve(TUI_SRC, indicator)
    if (existsSync(fullPath)) {
      existingFiles.push(indicator)
    }
  }

  if (existingFiles.length === 0) {
    return { feature, status: 'fail', details: `No TUI files found: ${feature.tuiIndicators.join(', ')}` }
  }

  // Check for code patterns in the found files
  const missingPatterns: string[] = []
  for (const pattern of feature.codePatterns) {
    let found = false
    for (const file of existingFiles) {
      const content = readFileSync(resolve(TUI_SRC, file), 'utf-8')
      if (content.toLowerCase().includes(pattern.toLowerCase())) {
        found = true
        break
      }
    }
    if (!found) missingPatterns.push(pattern)
  }

  if (missingPatterns.length > 0) {
    return { feature, status: 'fail', details: `Missing patterns in ${existingFiles.join(', ')}: ${missingPatterns.join(', ')}` }
  }

  return { feature, status: 'pass', details: `Found in: ${existingFiles.join(', ')}` }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const results = FEATURES.map(checkFeature)
const passes = results.filter(r => r.status === 'pass')
const fails = results.filter(r => r.status === 'fail')
const nas = results.filter(r => r.status === 'na')
const deferred = results.filter(r => r.status === 'deferred')

console.log(`\n${BOLD}TUI Feature Parity Audit${RESET}\n`)

// Group by tier
for (const tier of ['free', 'weaver', 'fabrick'] as const) {
  const tierResults = results.filter(r => r.feature.tier === tier)
  const tierPasses = tierResults.filter(r => r.status === 'pass')
  const _tierFails = tierResults.filter(r => r.status === 'fail')
  const tierNa = tierResults.filter(r => r.status === 'na')
  const tierDeferred = tierResults.filter(r => r.status === 'deferred')
  const applicable = tierResults.length - tierNa.length - tierDeferred.length

  const pct = applicable > 0 ? Math.round((tierPasses.length / applicable) * 100) : 100
  const color = pct === 100 ? GREEN : pct >= 70 ? YELLOW : RED

  const extras = [
    tierNa.length > 0 ? `${tierNa.length} N/A` : '',
    tierDeferred.length > 0 ? `${tierDeferred.length} deferred` : '',
  ].filter(Boolean).join(', ')
  console.log(`${BOLD}${tier.toUpperCase()} TIER${RESET} ${color}${pct}%${RESET} (${tierPasses.length}/${applicable} features${extras ? `, ${extras}` : ''})`)

  for (const r of tierResults) {
    const icon = r.status === 'pass' ? `${GREEN}PASS${RESET}`
      : r.status === 'na' ? `${DIM}N/A ${RESET}`
      : r.status === 'deferred' ? `${YELLOW}DEFER${RESET}`
      : `${RED}FAIL${RESET}`
    console.log(`  ${icon}  ${r.feature.name}`)
    if (r.status === 'fail' || r.status === 'deferred') {
      console.log(`         ${DIM}${r.details}${RESET}`)
    }
  }
  console.log()
}

// Summary
const applicable = results.length - nas.length - deferred.length
const pct = applicable > 0 ? Math.round((passes.length / applicable) * 100) : 100
const deferredMsg = deferred.length > 0 ? `, ${deferred.length} deferred` : ''
console.log(`${BOLD}Overall:${RESET} ${passes.length}/${applicable} features (${pct}%), ${nas.length} N/A${deferredMsg}, ${fails.length} gaps\n`)

if (fails.length > 0) {
  console.log(`${RED}${BOLD}Gaps:${RESET}`)
  for (const f of fails) {
    console.log(`  - ${f.feature.name} (${f.feature.tier})`)
  }
  console.log()
}

// Save report
const now = new Date().toISOString()
saveReport({
  reportName: 'tui-parity',
  timestamp: now,
  durationMs: 0,
  result: fails.length > 0 ? 'fail' : 'pass',
  summary: { total: results.length, pass: passes.length, fail: fails.length, na: nas.length, deferred: deferred.length, pct },
  data: results.map(r => ({ id: r.feature.id, name: r.feature.name, tier: r.feature.tier, status: r.status, details: r.details })),
})

process.exit(fails.length > 0 ? 1 : 0)
