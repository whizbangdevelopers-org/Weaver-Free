// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Nix Deps Hash Drift Auditor
 *
 * Ensures `nixos/package.nix` `npmDepsHash` stays in sync with the actual
 * `package-lock.json`. Without this, `nix-build -A weaver-free` fails on
 * every user's machine with a hash-mismatch error the moment a Dependabot
 * bump or `npm audit fix` changes the lockfile without someone manually
 * re-running `nix-prefetch-npm-deps`.
 *
 * How it works:
 *
 *   1. Compute a content-hash marker from `package-lock.json` (first 16 hex
 *      chars of sha256). This is NOT the Nix SRI hash — it's a cheap drift
 *      detector we can compute without Nix tooling in CI.
 *
 *   2. Read `nixos/package.nix` for a `# lockfile-marker: <16 hex>` comment
 *      paired with the `npmDepsHash` line.
 *
 *   3. If the comment marker equals the lockfile hash → pass. The author
 *      updated both in the same commit.
 *
 *   4. If they differ → fail with remediation instructions.
 *
 * Why a marker comment instead of recomputing the real Nix SRI hash: the
 * Nix SRI requires `nix-prefetch-npm-deps`, which requires Nix installed
 * in CI. That'd add ~60s per push. The marker is a free proxy that catches
 * "lockfile changed, hash not refreshed" — the exact failure mode we saw.
 */

import { createHash } from 'crypto'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const LOCKFILE = resolve(CODE_ROOT, 'package-lock.json')
const PACKAGE_NIX = resolve(CODE_ROOT, 'nixos', 'package.nix')

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function fail(message: string): never {
  console.log(`${RED}\u2717${RESET} nix-deps-hash`)
  console.log(`  ${DIM}${message.split('\n').join('\n  ')}${RESET}`)
  console.log()
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — nixos/package.nix npmDepsHash is out of sync with package-lock.json`)
  process.exit(1)
}

function pass(detail: string): void {
  console.log(`${GREEN}\u2713${RESET} nix-deps-hash ${DIM}— ${detail}${RESET}`)
  console.log()
  console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — nixos/package.nix marker matches package-lock.json`)
}

// ---------------------------------------------------------------------------

if (!existsSync(LOCKFILE)) fail(`package-lock.json not found at ${LOCKFILE}`)
if (!existsSync(PACKAGE_NIX)) fail(`nixos/package.nix not found at ${PACKAGE_NIX}`)

const lockfileContent = readFileSync(LOCKFILE)
const lockfileMarker = createHash('sha256').update(lockfileContent).digest('hex').slice(0, 16)

const nixContent = readFileSync(PACKAGE_NIX, 'utf-8')
const markerMatch = nixContent.match(/#\s*lockfile-marker:\s*([a-f0-9]{16})/)

if (!markerMatch) {
  fail(
    [
      'nixos/package.nix missing `# lockfile-marker: <16 hex>` comment.',
      '',
      'Add one directly after the npmDepsHash line. Current marker value:',
      `  # lockfile-marker: ${lockfileMarker}`,
      '',
      'This auditor pairs the comment with npmDepsHash so CI can detect',
      'lockfile drift without needing `nix-prefetch-npm-deps` installed.',
    ].join('\n'),
  )
}

if (markerMatch[1] !== lockfileMarker) {
  fail(
    [
      'package-lock.json has changed since npmDepsHash was last updated.',
      '',
      `  pinned marker: ${markerMatch[1]}`,
      `  current hash:  ${lockfileMarker}`,
      '',
      'Remediation:',
      '',
      '  1. Compute the new Nix SRI hash:',
      "     nix-shell -p prefetch-npm-deps --run 'prefetch-npm-deps package-lock.json'",
      '',
      '  2. Copy the printed sha256-... value into nixos/package.nix as npmDepsHash.',
      '',
      '  3. Update the lockfile-marker comment to:',
      `     # lockfile-marker: ${lockfileMarker}`,
      '',
      '  4. Commit both changes in one commit.',
      '',
      'Or run the helper (installs prefetch-npm-deps on demand):',
      '  npm run nix:refresh-deps-hash',
    ].join('\n'),
  )
}

pass(`lockfile-marker ${lockfileMarker} matches`)
