// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile, listFiles } from '../utils/file-reader.js'

interface HookRule {
  pattern: string
  action: string
}

interface Hook {
  file: string
  event: 'PreToolUse' | 'PostToolUse' | 'PreCompact' | 'Unknown'
  tool?: string
  summary: string
  triggers: string[]
  blocks?: string[]
  injects?: string[]
  bypass?: string
  rules: HookRule[]
}

interface HooksInventoryResult {
  hooks: Hook[]
  keyBlockedCommands: string[]
  warnings: string[]
}

function detectEvent(content: string): Hook['event'] {
  if (content.includes('PreToolUse')) return 'PreToolUse'
  if (content.includes('PostToolUse')) return 'PostToolUse'
  if (content.includes('PreCompact')) return 'PreCompact'
  return 'Unknown'
}

function extractTriggerPatterns(content: string): string[] {
  // Find grep -qE patterns that determine when the hook fires
  const patterns: string[] = []
  const grepRegex = /grep\s+-qE?\s+'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = grepRegex.exec(content)) !== null) {
    patterns.push(m[1])
  }
  return [...new Set(patterns)]
}

/**
 * @param projectRoot   Absolute path to code/ directory (PROJECT_ROOT in index.ts)
 * @param projectParent Absolute path to project root (PROJECT_PARENT in index.ts)
 */
export async function getHooksInventory(projectRoot: string, projectParent: string): Promise<HooksInventoryResult> {
  const warnings: string[] = []

  // Collect hooks from both .claude/hooks trees, tagged by scope prefix
  const codeHooksDir = resolve(projectRoot, '.claude/hooks')
  const projectHooksDir = resolve(projectParent, '.claude/hooks')

  const [codeFiles, projectFiles] = await Promise.all([
    listFiles(codeHooksDir, '.sh'),
    listFiles(projectHooksDir, '.sh'),
  ])

  // Pair each file path with its project-root-relative prefix for the `file` field
  const hookFilePairs: Array<{ filePath: string; prefix: string }> = [
    ...codeFiles.map(f => ({ filePath: f, prefix: 'code/.claude/hooks' })),
    ...projectFiles.map(f => ({ filePath: f, prefix: '.claude/hooks' })),
  ]

  if (hookFilePairs.length === 0) {
    warnings.push('No .sh hook files found in code/.claude/hooks or .claude/hooks')
  }

  const hooks: Hook[] = []

  for (const { filePath, prefix } of hookFilePairs) {
    const content = await safeReadFile(filePath)
    if (!content) continue

    const fileName = filePath.split('/').pop()!
    const event = detectEvent(content)
    const triggers = extractTriggerPatterns(content)

    // Parse each hook's specifics by name
    let hook: Hook

    if (fileName === 'block-dangerous.sh') {
      hook = {
        file: `${prefix}/${fileName}`,
        event: 'PreToolUse',
        tool: 'Bash',
        summary: 'Blocks destructive git commands and bare Playwright test invocations',
        triggers: ['Any Bash tool call'],
        blocks: [
          'git push --force (use --force-with-lease if needed)',
          'git reset --hard (use git stash or git checkout instead)',
          'git clean -f (deletes untracked files permanently)',
          'rm -rf on system directories (/, ~, $HOME, /home, /etc, /var — except /var/lib/weaver/ and /var/lib/microvms/)',
          'npx playwright test (E2E must run via testing/e2e-docker/scripts/run-tests.sh)',
        ],
        rules: [
          { pattern: 'git push.*--force', action: 'Block — use --force-with-lease' },
          { pattern: 'git reset --hard', action: 'Block — use git stash' },
          { pattern: 'git clean -f', action: 'Block — permanent untracked file deletion' },
          { pattern: 'rm -rf (system paths)', action: 'Block — except /var/lib/weaver/ and /var/lib/microvms/' },
          { pattern: 'npx playwright test', action: 'Block — use Docker E2E runner instead' },
        ],
      }
    } else if (fileName === 'require-e2e-docs.sh') {
      hook = {
        file: `${prefix}/${fileName}`,
        event: 'PreToolUse',
        tool: 'Bash',
        summary: 'Blocks git commit when feature code is staged without E2E specs or documentation',
        triggers: ['git commit commands'],
        blocks: [
          'Commit with staged src/**/*.{vue,ts} or backend/src/**/*.ts but no testing/e2e/*.spec.ts',
          'Commit with feature code but no docs/ update or HelpPage.vue update',
        ],
        bypass: 'Include [skip-e2e-check] in the commit message (for config/refactor-only commits)',
        rules: [
          { pattern: 'git commit with feature code staged', action: 'Require testing/e2e/*.spec.ts and docs update' },
          { pattern: 'docs-only, config-only, test-only staged', action: 'Allow — no enforcement' },
        ],
      }
    } else if (fileName === 'e2e-review-specs.sh') {
      hook = {
        file: `${prefix}/${fileName}`,
        event: 'PreToolUse',
        tool: 'Bash',
        summary: 'Blocks E2E test runs when source code changed but no E2E specs were updated. Outputs a directive with suggested spec files to create/update.',
        triggers: ['testing/e2e-docker/scripts/run-tests.sh', 'testing/e2e-docker/scripts/run-single.sh'],
        blocks: [
          'E2E test run when src/pages|components|composables|stores|services or backend/src/routes|services|storage|models changed without corresponding spec updates',
        ],
        bypass: 'Set SKIP_SPEC_REVIEW=1 environment variable (for refactor-only changes)',
        rules: [
          { pattern: 'code changed, no specs updated', action: 'Block + emit directive with suggested spec mappings' },
          { pattern: 'specs also changed', action: 'Allow — specs are being updated' },
          { pattern: 'no code files changed', action: 'Allow — no review needed' },
        ],
        injects: ['Suggested spec file list with source→spec mappings, quick reference for writing specs'],
      }
    } else if (fileName === 'e2e-inject-lessons.sh') {
      hook = {
        file: `${prefix}/${fileName}`,
        event: 'PreToolUse',
        tool: 'Bash',
        summary: 'Injects the Testing section from KNOWN-GOTCHAS.md and .claude/rules/testing.md into context before each E2E run. Never blocks.',
        triggers: ['testing/e2e-docker/scripts/run-tests.sh', 'run-single.sh', 'run-ui.sh'],
        injects: [
          'docs/development/KNOWN-GOTCHAS.md § Testing section',
          '.claude/rules/testing.md quick reference rules',
        ],
        rules: [
          { pattern: 'E2E run script invoked', action: 'Inject known gotchas and testing rules into context (always allows)' },
        ],
      }
    } else if (fileName === 'e2e-capture-lessons.sh') {
      hook = {
        file: `${prefix}/${fileName}`,
        event: 'PostToolUse',
        tool: 'Bash',
        summary: 'After E2E runs, parses test-results.json and emits a directive: failures get triage instructions, all-pass gets a "capture new lessons?" prompt. Never blocks.',
        triggers: ['testing/e2e-docker/scripts/run-tests.sh', 'run-single.sh (post-tool)'],
        injects: [
          'Test results summary (expected/unexpected/flaky/skipped/duration)',
          'Failed test titles with file:line and first error line',
          'Flaky test list',
          'Action directive: triage failures → write lesson to KNOWN-GOTCHAS.md or LESSONS-LEARNED.md',
        ],
        rules: [
          { pattern: 'results file missing', action: 'Emit infra failure guidance' },
          { pattern: 'results file stale (>10min)', action: 'Skip — previous run results' },
          { pattern: 'failures > 0', action: 'Emit failure details + triage instructions' },
          { pattern: 'flaky > 0', action: 'Emit flaky list + lesson capture prompt' },
          { pattern: 'all pass', action: 'Emit clean-run confirmation, optional lesson check' },
        ],
      }
    } else if (fileName === 'precompact-context.sh') {
      hook = {
        file: `${prefix}/${fileName}`,
        event: 'PreCompact',
        summary: 'Re-injects critical project context before conversation compaction so it survives context compression',
        triggers: ['Context compaction (automatic)'],
        injects: [
          'Port layout table (NixOS 3100, Dev 9010/3110, E2E 9020/3120)',
          'Provisioning paths (flake generator, ISO-install, cloud-init)',
          'Key rules: NixOS paths, E2E Docker-only, WebSocket URL pattern, execFileAsync, service user, no Co-Authored-By',
          'Backend environment defaults (BRIDGE_INTERFACE, PREMIUM_ENABLED, mock mode)',
        ],
        rules: [
          { pattern: 'PreCompact event', action: 'Output port layout + key rules to stdout for inclusion in compacted context' },
        ],
      }
    } else {
      hook = {
        file: `${prefix}/${fileName}`,
        event,
        summary: 'Unknown hook — see file for details',
        triggers,
        rules: [],
      }
      warnings.push(`Unrecognized hook file ${fileName} — added with minimal metadata`)
    }

    hooks.push(hook)
  }

  const keyBlockedCommands = [
    'git push --force',
    'git reset --hard',
    'git clean -f',
    'rm -rf <system paths>',
    'npx playwright test (must use Docker runner)',
    'git commit with feature code but no E2E specs (bypass: [skip-e2e-check])',
    'E2E test run when code changed but specs not updated (bypass: SKIP_SPEC_REVIEW=1)',
  ]

  return { hooks, keyBlockedCommands, warnings }
}
