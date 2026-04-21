// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * NUR Dispatch Completeness Auditor
 *
 * Enforces that every `repository-dispatch` step in `release.yml` targeting
 * the NUR repo carries BOTH hashes required to rebuild `weaver-free`:
 *
 *   - `version`       — human version (e.g. "1.0.2")
 *   - `hash`          — source tarball SRI (fetchFromGitHub)
 *   - `npmDepsHash`   — buildNpmPackage's npm-deps prefetch SRI
 *
 * Why this auditor exists:
 *
 * The v1.0.2 release shipped to NUR with only `version` + `hash` dispatched.
 * NUR's receiver workflow already accepted `npmDepsHash`, but the sender
 * never sent it, so NUR's `weaver-free/default.nix` stayed frozen at a stale
 * `npmDepsHash` from a prior manual update. When `package-lock.json` changed
 * between releases the two values diverged and NUR's Test build failed with:
 *
 *   error: hash mismatch in fixed-output derivation
 *     'weaver-free-<version>-npm-deps.drv':
 *       specified: sha256-<stale>=
 *          got:    sha256-<current>=
 *
 * The fix is one-sided (release.yml includes the hash in client-payload;
 * NUR receiver already handled it). This auditor locks the fix in so
 * future edits to release.yml cannot silently regress.
 *
 * Rules (fail the push if any violated):
 *   1. In `release.yml`, every step with `uses: peter-evans/repository-dispatch@*`
 *      whose `repository: ${{ env.NUR_REPO }}` must have a `client-payload`
 *      JSON object containing all three keys.
 *   2. The `npmDepsHash` value must reference a step output (not a literal)
 *      so CI actually computes it at release time. This prevents a regression
 *      where someone hardcodes a stale hash into the workflow.
 *
 * To fix a failure: add/update the dispatch step's client-payload to include
 * `"npmDepsHash": "${{ steps.<stepId>.outputs.<fieldName> }}"`, and ensure
 * the referenced step exists and computes the hash from
 * `code/nixos/package.nix` (authoritative because audit:nix-deps-hash already
 * enforces package.nix-matches-lockfile on every push).
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const RELEASE_WORKFLOW = resolve(PROJECT_ROOT, '.github', 'workflows', 'release.yml')

const REQUIRED_KEYS = ['version', 'hash', 'npmDepsHash'] as const

const DISPATCH_USES_MARKER = 'peter-evans/repository-dispatch@'
const NUR_REPO_MARKER = 'NUR_REPO'

interface Violation {
  file: string
  step: string
  reason: string
}

function findDispatchSteps(content: string): Array<{ start: number; end: number; block: string }> {
  // Find blocks that begin with `- name:` and include `uses: peter-evans/repository-dispatch@`
  // with `repository: ${{ env.NUR_REPO }}`. Return each block's text + position.
  const lines = content.split('\n')
  const blocks: Array<{ start: number; end: number; block: string }> = []

  let stepStart = -1
  let stepIndent = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const match = line.match(/^(\s*)- name:/)
    if (match) {
      // If we were tracking a step, close it
      if (stepStart >= 0) {
        blocks.push({
          start: stepStart,
          end: i - 1,
          block: lines.slice(stepStart, i).join('\n'),
        })
      }
      stepStart = i
      stepIndent = match[1]!.length
      continue
    }
    // Detect step-boundary dedent (a non-step line at <= stepIndent that isn't blank)
    if (stepStart >= 0 && line.trim() !== '' && !line.startsWith(' '.repeat(stepIndent + 1))) {
      const m = line.match(/^(\s*)\S/)
      if (m && m[1]!.length <= stepIndent) {
        blocks.push({
          start: stepStart,
          end: i - 1,
          block: lines.slice(stepStart, i).join('\n'),
        })
        stepStart = -1
        stepIndent = -1
      }
    }
  }
  if (stepStart >= 0) {
    blocks.push({
      start: stepStart,
      end: lines.length - 1,
      block: lines.slice(stepStart).join('\n'),
    })
  }

  return blocks.filter(
    (b) => b.block.includes(DISPATCH_USES_MARKER) && b.block.includes(NUR_REPO_MARKER),
  )
}

function extractClientPayload(block: string): string | null {
  // Match `client-payload: |` followed by indented JSON block.
  const idx = block.indexOf('client-payload:')
  if (idx < 0) return null
  const after = block.slice(idx)
  // Grab everything up to the next top-level YAML key at step-option indent
  // or end of block.
  const braceStart = after.indexOf('{')
  if (braceStart < 0) return null
  // Match from `{` to matching `}` at the same depth.
  let depth = 0
  for (let i = braceStart; i < after.length; i++) {
    if (after[i] === '{') depth++
    else if (after[i] === '}') {
      depth--
      if (depth === 0) return after.slice(braceStart, i + 1)
    }
  }
  return null
}

function audit(): Violation[] {
  const violations: Violation[] = []
  if (!existsSync(RELEASE_WORKFLOW)) {
    violations.push({
      file: RELEASE_WORKFLOW,
      step: '(file)',
      reason: 'release.yml not found',
    })
    return violations
  }

  const content = readFileSync(RELEASE_WORKFLOW, 'utf8')
  const dispatchSteps = findDispatchSteps(content)

  if (dispatchSteps.length === 0) {
    violations.push({
      file: '.github/workflows/release.yml',
      step: '(no dispatch step found)',
      reason:
        'No repository-dispatch step targeting NUR_REPO found. If NUR dispatch was removed intentionally, also remove this auditor from test:compliance.',
    })
    return violations
  }

  for (const { block } of dispatchSteps) {
    const nameMatch = block.match(/^\s*- name: (.+)$/m)
    const stepName = nameMatch ? nameMatch[1]!.trim() : '(unnamed)'

    const payload = extractClientPayload(block)
    if (!payload) {
      violations.push({
        file: '.github/workflows/release.yml',
        step: stepName,
        reason: 'client-payload JSON block could not be located or parsed',
      })
      continue
    }

    for (const key of REQUIRED_KEYS) {
      const keyRegex = new RegExp(`"${key}"\\s*:`, 'm')
      if (!keyRegex.test(payload)) {
        violations.push({
          file: '.github/workflows/release.yml',
          step: stepName,
          reason: `client-payload missing required key "${key}"`,
        })
      }
    }

    // Specifically for npmDepsHash: must reference a step output, not a literal
    const npmHashMatch = payload.match(/"npmDepsHash"\s*:\s*"([^"]+)"/)
    if (npmHashMatch) {
      const value = npmHashMatch[1]!
      if (!value.includes('${{')) {
        violations.push({
          file: '.github/workflows/release.yml',
          step: stepName,
          reason: `npmDepsHash is a hardcoded literal "${value}"; must reference a step output so CI computes it at release time (prevents stale-hash regression)`,
        })
      }
    }
  }

  return violations
}

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function main(): void {
  console.log(`${BOLD}NUR Dispatch Completeness Audit${RESET}`)
  console.log(
    `${DIM}Ensures release.yml's NUR dispatch sends {version, hash, npmDepsHash}.${RESET}`,
  )
  console.log(
    `${DIM}Without npmDepsHash the receiver silently keeps a stale value and the next NUR build fails.${RESET}`,
  )
  console.log()

  const violations = audit()

  if (violations.length === 0) {
    console.log(`  ${GREEN}✓${RESET} release.yml NUR dispatch carries all required hashes`)
    console.log()
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — NUR dispatch is complete`)
    process.exit(0)
  }

  for (const v of violations) {
    console.log(`  ${RED}✗${RESET} ${v.step}: ${v.reason}`)
  }
  console.log()
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${violations.length} violation(s)`)
  console.log()
  console.log('Remediation:')
  console.log(
    '  release.yml "Dispatch NUR weaver-free update" step must include npmDepsHash in',
  )
  console.log('  client-payload, referencing a step output (not a literal). Example:')
  console.log()
  console.log('    client-payload: |')
  console.log('      {')
  console.log('        "version": "${{ steps.hash.outputs.version }}",')
  console.log('        "hash": "${{ steps.hash.outputs.sri }}",')
  console.log('        "npmDepsHash": "${{ steps.npmdeps.outputs.npm_hash }}",')
  console.log('        "tag": "${{ github.ref_name }}"')
  console.log('      }')
  console.log()
  console.log('  The referenced step should extract from code/nixos/package.nix:')
  console.log(
    "    NPM_HASH=$(grep -oP 'npmDepsHash = \"\\Ksha256-[^\"]+' code/nixos/package.nix)",
  )
  process.exit(1)
}

main()
