// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * manual-test-checklist.ts — Generate a dynamic manual testing checklist.
 *
 * Diffs HEAD against a stored baseline SHA and maps changed files to feature
 * areas. Outputs a Markdown checklist of what needs manual testing.
 *
 * Usage:
 *   npx tsx scripts/manual-test-checklist.ts            # Generate checklist
 *   npx tsx scripts/manual-test-checklist.ts --verify    # Mark current HEAD as verified
 *   npx tsx scripts/manual-test-checklist.ts --json      # Structured JSON output
 *
 * Exit:  0 = checklist generated, 1 = error
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { resolve } from 'path'
import { parseArgs } from 'node:util'
import { saveReport } from './lib/save-report.js'

// ---------------------------------------------------------------------------
// ANSI colors
// ---------------------------------------------------------------------------
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROOT = resolve(import.meta.dirname, '..')
const SHA_FILE = resolve(ROOT, 'testing/.last-verified-sha')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FeatureArea {
  id: string
  name: string
  patterns: string[]
  testItems: string[]
}

interface ChecklistOutput {
  baseSha: string | null
  headSha: string
  changedFiles: string[]
  always: string[]
  changed: Array<{
    id: string
    name: string
    files: string[]
    testItems: string[]
  }>
  unchanged: string[]
  unmapped: string[]
}

// ---------------------------------------------------------------------------
// ALWAYS items — tested every single build
// ---------------------------------------------------------------------------
const ALWAYS_ITEMS = [
  'Admin user creation (first-time setup)',
  'Log in with the new admin account',
  'CirOS auto-provisions and transitions to running',
  'Dashboard loads cleanly (no console errors)',
  'Basic navigation works (all pages load)',
  'WebSocket status updates are flowing',
]

// ---------------------------------------------------------------------------
// Feature area definitions
// ---------------------------------------------------------------------------
const FEATURE_AREAS: FeatureArea[] = [
  {
    id: 'vm-dashboard',
    name: 'VM Dashboard',
    patterns: [
      'src/components/WorkloadCard',
      'src/components/VmListItem',
      'src/components/StatusBadge',
      'src/components/BulkActionBar',
      'src/components/DashboardToolbar',
      'src/pages/WorkbenchPage',
      'src/stores/workload-store',
      'src/composables/useVmSelection',
    ],
    testItems: [
      'Dashboard loads with VM cards',
      'Status badges show correct colors',
      'Bulk action bar works on multi-select',
    ],
  },
  {
    id: 'vm-detail',
    name: 'VM Detail Page',
    patterns: [
      'src/pages/WorkloadDetailPage',
      'src/components/SerialConsole',
      'src/components/VmConsole',
      'src/components/TagEditor',
    ],
    testItems: [
      'VM detail page loads when clicking a VM',
      'Console connects (if available)',
      'Tag editing works',
    ],
  },
  {
    id: 'vm-actions',
    name: 'VM Actions',
    patterns: [
      'backend/src/routes/vms.ts',
      'backend/src/services/microvm',
      'src/composables/useVmApi',
    ],
    testItems: [
      'Start/stop/restart actions work',
      'Action feedback shows correctly',
    ],
  },
  {
    id: 'ai-agent',
    name: 'AI Agent',
    patterns: [
      'backend/src/routes/agent',
      'backend/src/services/agent',
      'backend/src/services/mock-agent',
      'backend/src/services/llm-provider',
      'backend/src/schemas/agent',
      'src/composables/useAgent',
      'src/stores/agent-store',
      'src/components/AgentDialog',
    ],
    testItems: [
      'Agent dialog opens from VM card',
      'Mock agent streams response tokens',
      'Agent operation completes with summary',
    ],
  },
  {
    id: 'websocket',
    name: 'WebSocket Status',
    patterns: [
      'backend/src/routes/ws',
      'src/composables/useVmStatus',
      'src/services/ws',
    ],
    testItems: [
      'Live status updates arrive via WebSocket',
      'Status changes reflect within 2-3 seconds',
    ],
  },
  {
    id: 'auth',
    name: 'Authentication',
    patterns: [
      'backend/src/routes/auth',
      'backend/src/services/auth',
      'backend/src/middleware/auth',
      'backend/src/schemas/auth',
      'src/pages/LoginPage',
      'src/stores/auth-store',
      'src/composables/useAuth',
    ],
    testItems: [
      'Login page renders',
      'Login/logout cycle works',
      'Session persists across page reload',
    ],
  },
  {
    id: 'provisioning',
    name: 'VM Provisioning',
    patterns: [
      'backend/src/services/weaver/provisioner',
      'backend/src/services/image-manager',
      'backend/src/services/example-vm',
      'backend/src/services/provisioner-types',
      'backend/src/routes/weaver/',
      'backend/src/routes/distros',
      'backend/src/storage/distro-store',
      'backend/src/storage/catalog-store',
    ],
    testItems: [
      'CirOS provisions successfully after fresh install',
      'Provisioned VM starts and shows running status',
    ],
  },
  {
    id: 'nixos',
    name: 'NixOS Service',
    patterns: [
      'nixos/',
      'scripts/nix-fresh-install',
      'scripts/nix-rebuild-local',
    ],
    testItems: [
      'NixOS rebuild succeeds',
      'Service starts on port 3100',
      'systemctl status weaver is active',
    ],
  },
  {
    id: 'pwa',
    name: 'PWA / Service Worker',
    patterns: ['src-pwa/'],
    testItems: [
      'PWA loads from production build (no stale cache errors)',
      'Service worker registers without errors',
    ],
  },
  {
    id: 'tui',
    name: 'TUI',
    patterns: ['tui/'],
    testItems: [
      'TUI demo mode renders',
      'TUI connects to backend',
    ],
  },
  {
    id: 'users',
    name: 'User Management',
    patterns: [
      'backend/src/routes/users',
      'backend/src/storage/user-store',
      'src/pages/UsersPage',
      'backend/src/middleware/rbac',
    ],
    testItems: [
      'Users page loads (admin only)',
      'Role changes work',
    ],
  },
  {
    id: 'audit',
    name: 'Audit Log',
    patterns: [
      'backend/src/routes/audit',
      'backend/src/services/audit',
      'backend/src/storage/audit-store',
      'src/pages/AuditPage',
      'src/composables/useAudit',
    ],
    testItems: [
      'Audit page loads',
      'Actions appear in audit trail',
    ],
  },
  {
    id: 'layout',
    name: 'Layout / Styling',
    patterns: [
      'src/layouts/',
      'src/css/',
      'quasar.config',
    ],
    testItems: [
      'Navigation works',
      'Layout renders correctly',
      'No visual regressions',
    ],
  },
  {
    id: 'host-info',
    name: 'Host Info',
    patterns: [
      'backend/src/routes/host',
      'backend/src/services/host-info',
      'backend/src/schemas/host',
      'src/components/HostInfoStrip',
      'src/composables/useHostInfo',
    ],
    testItems: [
      'Host info strip shows system stats',
    ],
  },
  {
    id: 'network',
    name: 'Network Management',
    patterns: [
      'backend/src/routes/network',
      'backend/src/services/weaver/network-manager',
      'backend/src/storage/network-store',
      'src/pages/NetworkMapPage',
      'src/composables/useNetworkTopology',
      'src/stores/network-store',
      'src/components/weaver/network/',
    ],
    testItems: [
      'Network map page loads',
      'Topology renders correctly',
    ],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    patterns: [
      'backend/src/routes/notifications',
      'backend/src/services/notification',
      'backend/src/storage/notification',
      'src/components/NotificationBell',
      'src/components/NotificationPanel',
      'src/stores/notification-store',
      'src/composables/useNotifications',
    ],
    testItems: [
      'Notification bell shows count',
      'Notification panel opens',
    ],
  },
  {
    id: 'settings',
    name: 'Settings',
    patterns: [
      'src/pages/SettingsPage',
      'src/stores/settings-store',
      'src/components/settings/',
    ],
    testItems: [
      'Settings page loads',
      'Settings persist after change',
    ],
  },
  {
    id: 'help',
    name: 'Help Page',
    patterns: ['src/pages/HelpPage'],
    testItems: [
      'Help page loads',
      'FAQ sections expand/collapse',
    ],
  },
  {
    id: 'demo',
    name: 'Demo Mode',
    patterns: [
      'src/config/demo',
      'src/components/demo/',
      'src/components/DemoBanner',
      'src/pages/DemoLoginPage',
      'demo/',
    ],
    testItems: [
      'Demo banner shows',
      'Demo tier switcher works',
    ],
  },
  {
    id: 'backend-core',
    name: 'Backend Core',
    patterns: [
      'backend/src/config.ts',
      'backend/src/index.ts',
      'backend/src/license',
      'backend/src/storage/json-registry',
      'backend/src/storage/sqlite-registry',
      'backend/src/storage/seed-data',
      'backend/src/storage/vm-registry',
      'backend/src/middleware/rate-limit',
    ],
    testItems: [
      'Backend starts without errors',
      'Health endpoint returns 200',
    ],
  },
  {
    id: 'vm-crud',
    name: 'VM Create/Edit',
    patterns: [
      'src/components/AddVmDialog',
      'src/components/CreateVmDialog',
      'src/components/GettingStartedDialog',
    ],
    testItems: [
      'Create VM dialog works',
      'VM form validation works',
    ],
  },
  {
    id: 'router',
    name: 'Routing',
    patterns: ['src/router/'],
    testItems: [
      'All pages are navigable',
      'Deep links work',
    ],
  },
  {
    id: 'quotas',
    name: 'Quotas',
    patterns: [
      'backend/src/routes/quotas',
      'backend/src/storage/quota-store',
      'backend/src/schemas/quotas',
      'src/components/QuotaSection',
    ],
    testItems: [
      'Quota display shows limits and usage',
    ],
  },
  {
    id: 'vm-acl',
    name: 'VM Access Control',
    patterns: [
      'backend/src/routes/vm-acl',
      'backend/src/middleware/vm-acl',
      'backend/src/storage/vm-acl-store',
    ],
    testItems: [
      'Per-VM ACL enforcement works',
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function git(cmd: string): string {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf-8' }).trim()
}

function getBaselineSha(): string | null {
  if (!existsSync(SHA_FILE)) return null
  const sha = readFileSync(SHA_FILE, 'utf-8').trim()
  if (!sha || sha.length < 7) return null
  try {
    git(`rev-parse --verify ${sha}`)
    return sha
  } catch {
    return null
  }
}

function getHeadSha(): string {
  return git('rev-parse HEAD')
}

function getShortSha(sha: string): string {
  return sha.slice(0, 7)
}

function getCommitMessage(sha: string): string {
  return git(`log -1 --format=%s ${sha}`)
}

function getChangedFiles(baseSha: string, headSha: string): string[] {
  const output = git(`diff --name-only ${baseSha}...${headSha}`)
  return output ? output.split('\n').filter(Boolean) : []
}

function hasUncommittedChanges(): boolean {
  const status = git('status --porcelain')
  return status.length > 0
}

function matchFileToAreas(file: string): FeatureArea[] {
  return FEATURE_AREAS.filter(area =>
    area.patterns.some(pattern => {
      if (pattern.endsWith('/')) return file.startsWith(pattern)
      return file === pattern || file.startsWith(pattern + '/') || file.startsWith(pattern + '.')
    })
  )
}

function buildChecklist(baseSha: string | null, headSha: string): ChecklistOutput {
  const changedFiles = baseSha ? getChangedFiles(baseSha, headSha) : []

  // If no baseline, treat everything as changed
  const showAll = !baseSha

  const changedAreaIds = new Set<string>()
  const areaFiles = new Map<string, string[]>()
  const unmapped: string[] = []

  for (const file of changedFiles) {
    const areas = matchFileToAreas(file)
    if (areas.length === 0) {
      unmapped.push(file)
    } else {
      for (const area of areas) {
        changedAreaIds.add(area.id)
        const files = areaFiles.get(area.id) ?? []
        files.push(file)
        areaFiles.set(area.id, files)
      }
    }
  }

  const changed = (showAll ? FEATURE_AREAS : FEATURE_AREAS.filter(a => changedAreaIds.has(a.id)))
    .map(area => ({
      id: area.id,
      name: area.name,
      files: areaFiles.get(area.id) ?? [],
      testItems: area.testItems,
    }))

  const unchanged = showAll
    ? []
    : FEATURE_AREAS.filter(a => !changedAreaIds.has(a.id)).map(a => a.name)

  return {
    baseSha,
    headSha,
    changedFiles,
    always: ALWAYS_ITEMS,
    changed,
    unchanged,
    unmapped,
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatMarkdown(cl: ChecklistOutput): string {
  const lines: string[] = []

  const baseLabel = cl.baseSha ? getShortSha(cl.baseSha) : 'none'
  const headLabel = getShortSha(cl.headSha)

  lines.push(`# Manual Test Checklist (${baseLabel} → ${headLabel})`)
  lines.push(`Generated: ${new Date().toISOString()} | ${cl.changedFiles.length} files changed across ${cl.changed.length} feature areas`)

  if (!cl.baseSha) {
    lines.push('')
    lines.push(`> **No baseline SHA found** — showing all areas. Run \`npm run test:manual:verify\` after testing to set baseline.`)
  }

  lines.push('')
  lines.push('## ALWAYS (required every build)')
  for (const item of cl.always) {
    lines.push(`- [ ] ${item}`)
  }

  if (cl.changed.length > 0) {
    lines.push('')
    lines.push('## CHANGED — test these')
    for (const area of cl.changed) {
      lines.push('')
      const fileCount = area.files.length > 0 ? ` (${area.files.length} files changed)` : ''
      lines.push(`### ${area.name}${fileCount}`)
      for (const item of area.testItems) {
        lines.push(`- [ ] ${item}`)
      }
      if (area.files.length > 0) {
        lines.push(`  _Changed files:_`)
        for (const file of area.files) {
          lines.push(`  - ${file}`)
        }
      }
    }
  }

  if (cl.unchanged.length > 0) {
    lines.push('')
    lines.push('## UNCHANGED (skip unless regression suspected)')
    lines.push(cl.unchanged.join(', '))
  }

  if (cl.unmapped.length > 0) {
    lines.push('')
    lines.push('## Other Changes (no feature area mapping)')
    for (const file of cl.unmapped) {
      lines.push(`- ${file}`)
    }
  }

  lines.push('')
  lines.push('---')
  lines.push('Verify: `npm run test:manual:verify`')
  lines.push('')

  return lines.join('\n')
}

function formatConsole(cl: ChecklistOutput): string {
  const lines: string[] = []

  const baseLabel = cl.baseSha ? getShortSha(cl.baseSha) : 'none'
  const headLabel = getShortSha(cl.headSha)

  lines.push(`${BOLD}Manual Test Checklist${RESET} (${DIM}${baseLabel} → ${headLabel}${RESET})`)
  lines.push(`${DIM}${cl.changedFiles.length} files changed across ${cl.changed.length} feature areas${RESET}`)

  if (!cl.baseSha) {
    lines.push('')
    lines.push(`${YELLOW}No baseline SHA found — showing all areas.${RESET}`)
    lines.push(`${DIM}Run 'npm run test:manual:verify' after testing to set baseline.${RESET}`)
  }

  if (hasUncommittedChanges()) {
    lines.push('')
    lines.push(`${YELLOW}Warning: uncommitted changes detected — checklist is based on committed files only.${RESET}`)
  }

  lines.push('')
  lines.push(`${BOLD}${CYAN}ALWAYS (required every build)${RESET}`)
  for (const item of cl.always) {
    lines.push(`  ${DIM}○${RESET} ${item}`)
  }

  if (cl.changed.length > 0) {
    lines.push('')
    lines.push(`${BOLD}${RED}CHANGED — test these${RESET}`)
    for (const area of cl.changed) {
      const fileCount = area.files.length > 0 ? ` ${DIM}(${area.files.length} files)${RESET}` : ''
      lines.push(``)
      lines.push(`  ${BOLD}${area.name}${RESET}${fileCount}`)
      for (const item of area.testItems) {
        lines.push(`    ${DIM}○${RESET} ${item}`)
      }
      if (area.files.length > 0) {
        for (const file of area.files) {
          lines.push(`    ${DIM}  ${file}${RESET}`)
        }
      }
    }
  }

  if (cl.unchanged.length > 0) {
    lines.push('')
    lines.push(`${GREEN}UNCHANGED (skip)${RESET}`)
    lines.push(`  ${DIM}${cl.unchanged.join(', ')}${RESET}`)
  }

  if (cl.unmapped.length > 0) {
    lines.push('')
    lines.push(`${YELLOW}Other changes (unmapped)${RESET}`)
    for (const file of cl.unmapped) {
      lines.push(`  ${DIM}${file}${RESET}`)
    }
  }

  lines.push('')
  lines.push(`${DIM}Verify: npm run test:manual:verify${RESET}`)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const start = Date.now()

  const { values } = parseArgs({
    options: {
      verify: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      markdown: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })

  if (values.help) {
    console.log(`Usage: npx tsx scripts/manual-test-checklist.ts [options]

Options:
  --verify     Mark current HEAD as verified (updates baseline SHA)
  --json       Output structured JSON
  --markdown   Output Markdown (default is colored console)
  -h, --help   Show this help`)
    process.exit(0)
  }

  const headSha = getHeadSha()

  // --verify mode: update baseline and exit
  if (values.verify) {
    writeFileSync(SHA_FILE, headSha + '\n')
    const msg = getCommitMessage(headSha)
    console.log(`${GREEN}✓ Baseline updated to ${getShortSha(headSha)} (${msg})${RESET}`)

    saveReport({
      reportName: 'manual-checklist',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
      result: 'pass',
      summary: { action: 'verify', sha: headSha, message: msg },
      data: { verified: true, sha: headSha },
    })
    return
  }

  // Generate checklist
  const baseSha = getBaselineSha()

  if (baseSha && baseSha === headSha) {
    console.log(`${GREEN}✓ No changes since last verified build (${getShortSha(headSha)})${RESET}`)
    return
  }

  const checklist = buildChecklist(baseSha, headSha)

  if (values.json) {
    console.log(JSON.stringify(checklist, null, 2))
  } else if (values.markdown) {
    console.log(formatMarkdown(checklist))
  } else {
    console.log(formatConsole(checklist))
  }

  saveReport({
    reportName: 'manual-checklist',
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
    result: 'pass',
    summary: {
      baseSha: baseSha ?? 'none',
      headSha,
      totalFilesChanged: checklist.changedFiles.length,
      areasChanged: checklist.changed.length,
      areasUnchanged: checklist.unchanged.length,
      unmappedFiles: checklist.unmapped.length,
    },
    data: checklist,
  })
}

main()
