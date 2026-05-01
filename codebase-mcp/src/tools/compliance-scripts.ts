// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'

interface ComplianceScript {
  npmCommand: string
  scriptFile: string
  description: string
  checks: string[]
  failsOn: string[]
  inChains: string[]
  blocksRelease: boolean
}

interface ComplianceChain {
  name: string
  npmCommand: string
  scripts: string[]
  when: string
}

interface ComplianceScriptsResult {
  scripts: ComplianceScript[]
  chains: ComplianceChain[]
  totalInCompliance: number
  warnings: string[]
}

async function extractScriptDescription(projectRoot: string, scriptFile: string): Promise<{ description: string; checks: string[] }> {
  const content = await safeReadFile(resolve(projectRoot, 'scripts', scriptFile))
  if (!content) return { description: '(could not read)', checks: [] }

  // Extract JSDoc block comment at top of file
  const jsdocMatch = content.match(/^\/\*\*([\s\S]*?)\*\//m)
  if (!jsdocMatch) {
    // Try single-line comment
    const lineMatch = content.match(/^\/\/\s*(.+)/)
    return { description: lineMatch?.[1]?.trim() ?? '(no description)', checks: [] }
  }

  const jsdoc = jsdocMatch[1]
    .split('\n')
    .map(l => l.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean)

  const description = jsdoc[0] ?? '(no description)'

  // Extract bullet points as checks
  const checks = jsdoc
    .slice(1)
    .filter(l => l.startsWith('-') || l.startsWith('•'))
    .map(l => l.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 8)

  return { description, checks }
}

export async function getComplianceScripts(
  projectRoot: string,
  chain?: string
): Promise<ComplianceScriptsResult> {
  const warnings: string[] = []

  const chains: ComplianceChain[] = [
    {
      name: 'test:precommit',
      npmCommand: 'npm run test:precommit',
      when: 'Every commit (git pre-commit hook)',
      scripts: ['lint', 'typecheck', 'test:unit:run', 'test:backend', 'test:tui'],
    },
    {
      name: 'test:prepush',
      npmCommand: 'npm run test:prepush',
      when: 'Every push (git pre-push hook)',
      scripts: ['test:precommit', 'test:security', 'test:compliance'],
    },
    {
      name: 'test:compliance',
      npmCommand: 'npm run test:compliance',
      when: 'Every push (via test:prepush)',
      scripts: [
        'audit:forms', 'audit:routes', 'audit:e2e-coverage', 'audit:legal',
        'audit:doc-freshness', 'audit:tier-parity', 'audit:tui-parity',
        'build:tui', 'audit:cli-args', 'audit:ws-codes', 'audit:bundle',
        'audit:license', 'audit:lockfile', 'audit:sast', 'audit:doc-parity',
      ],
    },
    {
      name: 'test:prerelease',
      npmCommand: 'npm run test:prerelease',
      when: 'Before release tagging',
      scripts: ['test:prepush', 'e2e', 'e2e:free'],
    },
  ]

  // Build the compliance script inventory with live JSDoc extraction
  const scriptDefs: Array<{
    npmCommand: string
    scriptFile: string
    inChains: string[]
    blocksRelease: boolean
    checksOverride?: string[]
    failsOn: string[]
  }> = [
    {
      npmCommand: 'audit:forms',
      scriptFile: 'verify-form-rules.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['q-input without :rules for fields with backend Zod constraints', 'Missing lazy-rules', 'Missing validate() gate on submit'],
    },
    {
      npmCommand: 'audit:routes',
      scriptFile: 'verify-route-auth.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['Routes missing requireRole preHandler (not in exemptions list)', 'Routes missing rate limit', 'Routes missing tier gate when expected'],
    },
    {
      npmCommand: 'audit:e2e-coverage',
      scriptFile: 'verify-form-e2e-coverage.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['Form fields with :rules not covered by any E2E spec', 'Zod schemas with no corresponding E2E test'],
    },
    {
      npmCommand: 'audit:legal',
      scriptFile: 'verify-legal-ip.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['Missing LICENSE file', 'Missing copyright notice in package.json', 'AI training restriction missing', 'Commons Clause missing'],
    },
    {
      npmCommand: 'audit:doc-freshness',
      scriptFile: 'verify-doc-freshness.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['DEVELOPER-GUIDE.md not updated after route/page/store changes', 'HelpPage.vue not updated after user-visible feature changes'],
    },
    {
      npmCommand: 'audit:tier-parity',
      scriptFile: 'verify-tier-parity.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['Tier gates in code not listed in tier-matrix.json', 'tier-matrix.json entries with no code gate (orphans)', 'requireTier() tier mismatch with matrix'],
    },
    {
      npmCommand: 'audit:tui-parity',
      scriptFile: 'verify-tui-parity.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['TUI missing features present in web UI for same tier', 'Web UI features at free/weaver not in TUI'],
    },
    {
      npmCommand: 'audit:cli-args',
      scriptFile: 'verify-cli-args.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['npm run start:tui/dev:tui scripts that use nested npm run (swallows -- args)', 'Binary not invoked directly'],
    },
    {
      npmCommand: 'audit:ws-codes',
      scriptFile: 'verify-ws-codes.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['WebSocket close codes in code not documented in DEVELOPER-GUIDE.md', 'Documented codes not used in code'],
    },
    {
      npmCommand: 'audit:bundle',
      scriptFile: 'check-bundle-size.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['Individual JS chunk > 500 KB', 'Total JS > 2000 KB', 'Total CSS > 600 KB'],
    },
    {
      npmCommand: 'audit:license',
      scriptFile: 'audit-licenses.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['npm dependency with GPL/LGPL/AGPL/SSPL/CC license (copyleft risk)', 'Unknown license in dependency tree'],
    },
    {
      npmCommand: 'audit:lockfile',
      scriptFile: 'verify-lockfile.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['package-lock.json out of sync with package.json', 'Lock file missing required integrity hashes'],
    },
    {
      npmCommand: 'audit:sast',
      scriptFile: 'audit-sast.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['child_process with unsanitized input (command injection)', 'innerHTML/v-html with user input (XSS)', 'Unsanitized path joins (path traversal)', 'Hardcoded secrets/API keys in source', 'eval() usage', 'Prototype pollution patterns'],
    },
    {
      npmCommand: 'audit:doc-parity',
      scriptFile: 'verify-doc-parity.ts',
      inChains: ['test:compliance', 'test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['agents/vX.Y.0/MANIFEST.md missing Reviewed: date for next-in-queue version', 'MANIFEST.md missing for a version that is next in the Forge queue'],
    },
    {
      npmCommand: 'test:security',
      scriptFile: 'security-audit.sh',
      inChains: ['test:prepush', 'test:prerelease'],
      blocksRelease: true,
      failsOn: ['npm audit finding with severity >= high not in known-blocked list', 'New unknown vulnerable dependency'],
    },
    {
      npmCommand: 'verify:release',
      scriptFile: 'verify-post-release.ts',
      inChains: [],
      blocksRelease: false,
      failsOn: ['GitHub release tag not found for version', 'sync-to-free workflow did not complete', 'Demo site not updated'],
    },
    {
      npmCommand: 'test:manual',
      scriptFile: 'manual-test-checklist.ts',
      inChains: [],
      blocksRelease: false,
      failsOn: ['(manual review) — generates checklist based on diff from last verified SHA'],
    },
  ]

  const scripts: ComplianceScript[] = []

  for (const def of scriptDefs) {
    if (chain && !def.inChains.includes(chain) && def.npmCommand !== chain) continue

    const { description, checks } = await extractScriptDescription(projectRoot, def.scriptFile)

    scripts.push({
      npmCommand: `npm run ${def.npmCommand}`,
      scriptFile: `scripts/${def.scriptFile}`,
      description,
      checks: def.checksOverride ?? checks,
      failsOn: def.failsOn,
      inChains: def.inChains,
      blocksRelease: def.blocksRelease,
    })
  }

  return {
    scripts,
    chains: chain ? chains.filter(c => c.name === chain || c.scripts.includes(chain)) : chains,
    totalInCompliance: scriptDefs.filter(s => s.inChains.includes('test:compliance')).length,
    warnings,
  }
}
