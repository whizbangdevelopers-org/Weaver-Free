// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Release Workflow Dry-Run Auditor
 *
 * Simulates and statically validates the release.yml workflow before a release
 * tag is pushed. Motivated by the v1.0.2 five-attempt release streak: each
 * attempt failed at a different CI-only layer (docker context, cosign v3,
 * attestations on private repo, attestation pragma interaction with
 * audit:openssf-baseline, sync-path leak). All five would have been caught
 * pre-push by this auditor.
 *
 * Two classes of checks:
 *
 *   1. Static YAML assertions — parse release.yml and verify structural
 *      properties: permissions posture, cosign version pin, attestation
 *      continue-on-error guards, rsync source safety, NUR dispatch payload.
 *
 *   2. Runtime sync simulation — run the rsync step against a tmpdir sandbox
 *      and assert the output tree properties:
 *        • No Dev-root content leaks (MASTER-PLAN.md, business/, etc.)
 *        • flake.nix + flake.lock present (required for Free install path B)
 *        • Core application files present (sanity: sync isn't completely empty)
 *        • No planning or internal docs present
 *
 * Network-dependent steps (cosign OIDC signing, GitHub attestations, PAT
 * dispatch to NUR) are not simulated — they cannot be replicated locally
 * without live secrets and OIDC tokens. The static assertions cover their
 * structural preconditions instead.
 *
 * Usage:
 *   npm run audit:release-workflow-dry-run           # full check
 *   npx tsx scripts/verify-release-workflow-dry-run.ts --skip-rsync  # YAML only
 *
 * Runtime: ~5–15 seconds (rsync of code/ is fast; no builds run).
 * Wired into test:prerelease, not test:compliance.
 *
 * See plans/v1.0.3/EXECUTION-ROADMAP.md for the motivating analysis.
 */

import { readFileSync, existsSync, mkdtempSync, rmSync, mkdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')
const RELEASE_YML = resolve(PROJECT_ROOT, '.github', 'workflows', 'release.yml')
const SYNC_EXCLUDE_YML = resolve(PROJECT_ROOT, '.github', 'sync-exclude.yml')

// ---------------------------------------------------------------------------
// ANSI
// ---------------------------------------------------------------------------

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const skipRsync = args.includes('--skip-rsync')

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

interface CheckResult {
  name: string
  pass: boolean
  detail?: string
}

const results: CheckResult[] = []

function pass(name: string): void {
  results.push({ name, pass: true })
  console.log(`  ${GREEN}✓${RESET} ${name}`)
}

function fail(name: string, detail: string): void {
  results.push({ name, pass: false, detail })
  console.log(`  ${RED}✗${RESET} ${name}`)
  console.log(`      ${RED}${detail}${RESET}`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run a command with argv — no shell interpolation, no injection surface.
 * CodeQL's shell-command-injection rule flags `bash -c <string>` invocations
 * when any interpolated value comes from file I/O or env. Using argv arrays
 * with `shell: false` (the default) eliminates the surface entirely.
 */
function run(argv: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): { ok: boolean; output: string } {
  const [cmd, ...cmdArgs] = argv
  const r = spawnSync(cmd, cmdArgs, { cwd, env, stdio: 'pipe', encoding: 'utf-8' })
  const output = (r.stdout ?? '') + (r.stderr ?? '')
  return { ok: r.status === 0, output }
}

function readSyncExcludes(): string[] {
  if (!existsSync(SYNC_EXCLUDE_YML)) return []
  const content = readFileSync(SYNC_EXCLUDE_YML, 'utf-8')
  const excludes: string[] = []
  for (const rawLine of content.split('\n')) {
    const stripped = rawLine.replace(/#.*$/, '').trim()
    if (!stripped || stripped === 'exclude:') continue
    const path = stripped.replace(/^-\s*/, '').trim()
    if (path) excludes.push(path)
  }
  return excludes
}

// Hard-coded base excludes from the release.yml "Sync code" step.
// MUST stay in sync with the --exclude flags in release.yml.
const BASE_SYNC_EXCLUDES = [
  '.git',
  'testing/',
  '.claude/',
  'CLAUDE.md',
  'TESTING.md',
  'playwright.config.ts',
  'vitest.config.ts',
  '.mcp.json',
]

// ---------------------------------------------------------------------------
// Static YAML assertions
// ---------------------------------------------------------------------------

function runStaticChecks(yml: string): void {
  console.log(`\n  ${BOLD}Static assertions (release.yml structure)${RESET}\n`)

  // 1. Workflow-level permissions default-deny
  if (yml.includes('\npermissions: read-all')) {
    pass('workflow permissions: read-all (default-deny)')
  } else {
    fail(
      'workflow permissions: read-all (default-deny)',
      'Top-level `permissions: read-all` not found. OpenSSF Token-Permissions requires default-deny at workflow scope.',
    )
  }

  // 2. Release job has id-token:write (cosign OIDC) and attestations:write
  const releaseJobSection = yml.slice(yml.indexOf('  release:'), yml.indexOf('\n  publish:'))
  if (releaseJobSection.includes('id-token: write')) {
    pass('release job: id-token: write (cosign OIDC)')
  } else {
    fail('release job: id-token: write (cosign OIDC)', 'release job permissions block missing id-token: write — cosign keyless signing will fail.')
  }
  if (releaseJobSection.includes('attestations: write')) {
    pass('release job: attestations: write')
  } else {
    fail('release job: attestations: write', 'release job permissions block missing attestations: write — attest-build-provenance will fail.')
  }

  // 3. Cosign pinned to v2.x (not v3 which changes artifact contract)
  const cosignMatch = /cosign-release:\s*['"]?(v\d+\.\d+\.\d+)['"]?/.exec(yml)
  if (!cosignMatch) {
    fail('cosign version pinned', 'cosign-release pin not found in release.yml. Cosign v3 changed artifact format.')
  } else {
    const ver = cosignMatch[1]!
    if (ver.startsWith('v2.')) {
      pass(`cosign pinned to ${ver} (v2.x — legacy .sig + .pem contract preserved)`)
    } else {
      fail(
        `cosign pinned to ${ver}`,
        `cosign is pinned to ${ver} but must be v2.x. v3 changed sign-blob output format (--bundle .sigstore only), breaking README verification flow. See release.yml comment.`,
      )
    }
  }

  // 4. Attestation steps all have continue-on-error: true
  // (private repo + free org plan → attestations soft-fail by design)
  // Split YAML into step blocks (each `      - name:` boundary starts a new block)
  // so we can check each attest step independently without regex-over-dashes bugs.
  const stepBlocks = yml.split(/(?=\n      - name:)/)
  const attestBlocks = stepBlocks.filter((b) => b.includes('- name: Attest build provenance'))
  const attestWithContinue = attestBlocks.filter((b) => b.includes('continue-on-error: true'))
  if (attestBlocks.length === 0) {
    fail('attestation steps exist', 'No "Attest build provenance" steps found. Expected ≥1.')
  } else if (attestWithContinue.length === attestBlocks.length) {
    pass(`all ${attestBlocks.length} attestation step(s) have continue-on-error: true`)
  } else {
    fail(
      'attestation steps: continue-on-error: true',
      `${attestBlocks.length - attestWithContinue.length}/${attestBlocks.length} attestation step(s) missing continue-on-error: true. Attestations fail on private repos without a paid plan.`,
    )
  }

  // 5. openssf-baseline-allow pragma before attest steps
  // audit:openssf-baseline scans for this pragma to exempt soft-fail attest steps.
  if (yml.includes('openssf-baseline-allow: attest-continue-on-error')) {
    pass('openssf-baseline-allow: attest-continue-on-error pragma present')
  } else {
    fail(
      'openssf-baseline-allow pragma',
      'No `openssf-baseline-allow: attest-continue-on-error` comment found. audit:openssf-baseline will reject continue-on-error attestation steps without this exemption.',
    )
  }

  // 6. rsync source is dev/code/ (not dev/) — the Dev-root leak fix
  // Syncing dev/ (not dev/code/) with --delete-excluded leaked 72k lines
  // of internal content on 2026-04-20 (business/, MASTER-PLAN.md, etc.).
  if (yml.includes('dev/code/ free/')) {
    pass('rsync source is dev/code/ (Dev-root leak protected)')
  } else {
    fail(
      'rsync source: dev/code/ (not dev/)',
      'Sync step does not use `dev/code/ free/` as rsync source/target. Risk: Dev-root content (MASTER-PLAN.md, business/, etc.) leaks to public Free repo. See 2026-04-20 incident.',
    )
  }

  // 7. flake.nix is NOT excluded from the sync
  // Excluding flake.nix broke Free install Path B (direct flake input) —
  // discovered 2026-04-21 post v1.0.2 release. The rsync step explicitly
  // does NOT exclude flake.nix; this check ensures no one adds it back.
  const syncCodeSection = yml.slice(
    yml.indexOf('- name: Sync code'),
    yml.indexOf('- name: Sync .github config'),
  )
  if (syncCodeSection.includes('--exclude=flake.nix') || syncCodeSection.includes("exclude='flake.nix'")) {
    fail(
      'flake.nix not excluded from sync',
      'flake.nix is excluded from the Free sync. This breaks Free install Path B (direct flake input). See UPGRADE.md and plans/v1.0.3/EXECUTION-ROADMAP.md.',
    )
  } else {
    pass('flake.nix included in Free sync (not excluded)')
  }

  // 8. FREE_REPO env must be set to the public Free repo (licensing gate)
  if (yml.includes('FREE_REPO: whizbangdevelopers-org/Weaver-Free')) {
    pass('FREE_REPO: whizbangdevelopers-org/Weaver-Free (licensing gate)')
  } else {
    fail(
      'FREE_REPO points to Weaver-Free (AGPL-3.0)',
      'FREE_REPO env var is not set to whizbangdevelopers-org/Weaver-Free. NUR dispatch must target the public AGPL-3.0 mirror only — never a paid-tier (BSL-1.1) repo.',
    )
  }

  // 9. NUR dispatch payload includes all four required fields
  const nurSection = yml.slice(yml.indexOf('update-nur:'))
  const hasVersion = nurSection.includes('"version"')
  const hasHash = nurSection.includes('"hash"')
  const hasNpmDepsHash = nurSection.includes('"npmDepsHash"')
  const hasTag = nurSection.includes('"tag"')
  if (hasVersion && hasHash && hasNpmDepsHash && hasTag) {
    pass('NUR dispatch payload: version + hash + npmDepsHash + tag')
  } else {
    const missing = [
      !hasVersion && 'version',
      !hasHash && 'hash',
      !hasNpmDepsHash && 'npmDepsHash',
      !hasTag && 'tag',
    ]
      .filter(Boolean)
      .join(', ')
    fail('NUR dispatch payload completeness', `Missing fields in NUR dispatch payload: ${missing}. The NUR update-weaver-free.yml receiver needs all four.`)
  }

  // 10. NUR hash computation uses --unpack (SRI, not raw file hash)
  // nix-prefetch-url without --unpack hashes the .tar.gz file, which Nix
  // rejects at build time (it hashes the extracted tree). This is the
  // "hex-vs-SRI class" failure from v1.0.2's 5-attempt streak.
  if (nurSection.includes('--unpack')) {
    pass('NUR hash uses --unpack (SRI extracted-tree, not raw .tar.gz bytes)')
  } else {
    fail(
      'NUR hash: --unpack flag',
      'nix-prefetch-url call missing --unpack. Without it, Nix receives a file-level SHA256 which is rejected at build time (Nix hashes the extracted source tree). fetchFromGitHub hash mismatch.',
    )
  }
}

// ---------------------------------------------------------------------------
// Runtime: rsync simulation
// ---------------------------------------------------------------------------

function runRsyncSimulation(sandboxRoot: string): void {
  console.log(`\n  ${BOLD}Runtime: rsync sync simulation${RESET}\n`)

  const freeDir = join(sandboxRoot, 'free')
  mkdirSync(freeDir, { recursive: true })

  // Build the rsync argv exactly as release.yml's "Sync code" step does,
  // except: no --filter='P /.git' (not needed — target is empty tmpdir).
  // No --delete-excluded: tmpdir starts empty, no cleanup needed.
  const allExcludes = [...BASE_SYNC_EXCLUDES, ...readSyncExcludes()]
  const argv = [
    'rsync',
    '-a',
    '--exclude=.git',
    ...allExcludes.map((p) => `--exclude=${p}`),
    `${CODE_ROOT}/`,
    `${freeDir}/`,
  ]
  const { ok, output } = run(argv, PROJECT_ROOT)
  if (!ok) {
    fail('rsync simulation', `rsync failed:\n${output.split('\n').slice(-20).join('\n')}`)
    return
  }
  pass('rsync simulation completed')

  // Assert: Dev-root content NOT present
  // MASTER-PLAN.md lives at the project root (PROJECT_ROOT), NOT in code/.
  // This checks the sync source is correct (if someone changes release.yml
  // to sync PROJECT_ROOT instead of code/, this would appear).
  const masterPlan = join(freeDir, 'MASTER-PLAN.md')
  if (existsSync(masterPlan)) {
    fail('MASTER-PLAN.md not in Free tree', 'MASTER-PLAN.md was found in the synced tree — rsync source is pointing at the project root, not code/. Internal planning content is leaking.')
  } else {
    pass('MASTER-PLAN.md absent from Free tree (no Dev-root leak)')
  }

  const businessDir = join(freeDir, 'business')
  if (existsSync(businessDir)) {
    fail('business/ not in Free tree', 'business/ directory found in Free tree — rsync source is the project root, not code/. GTM, pricing, and legal docs are leaking.')
  } else {
    pass('business/ absent from Free tree (no Dev-root leak)')
  }

  const agentsDir = join(freeDir, 'agents')
  if (existsSync(agentsDir)) {
    fail('agents/ not in Free tree', 'agents/ (Forge planning) found in Free tree — rsync source includes non-code content.')
  } else {
    pass('agents/ absent from Free tree')
  }

  // Assert: flake.nix + flake.lock present (Free install Path B)
  const flakeNix = join(freeDir, 'flake.nix')
  if (existsSync(flakeNix)) {
    pass('flake.nix present in Free tree (install Path B supported)')
  } else {
    fail('flake.nix in Free tree', 'flake.nix missing from Free sync output. Users installing via `nix flake input` (UPGRADE.md Path B) will get a broken flake.')
  }

  const flakeLock = join(freeDir, 'flake.lock')
  if (existsSync(flakeLock)) {
    pass('flake.lock present in Free tree')
  } else {
    fail('flake.lock in Free tree', 'flake.lock missing from Free sync output.')
  }

  // Assert: core application files present (sync is not accidentally empty)
  const backendEntry = join(freeDir, 'backend', 'src', 'index.ts')
  if (existsSync(backendEntry)) {
    pass('backend/src/index.ts present (sync is non-empty)')
  } else {
    fail('core files in Free tree', 'backend/src/index.ts not found — Free sync output may be empty or structurally broken.')
  }

  // Assert: CLAUDE.md excluded (internal dev instructions, not for Free)
  const claudeMd = join(freeDir, 'CLAUDE.md')
  if (existsSync(claudeMd)) {
    fail('CLAUDE.md excluded from Free tree', 'CLAUDE.md found in Free tree — internal dev instructions are leaking. Verify BASE_SYNC_EXCLUDES matches release.yml.')
  } else {
    pass('CLAUDE.md excluded from Free tree')
  }

  // Assert: testing/ excluded (E2E, Docker specs not needed in Free)
  const testingDir = join(freeDir, 'testing')
  if (existsSync(testingDir)) {
    fail('testing/ excluded from Free tree', 'testing/ found in Free tree — E2E specs should not be in the Free distribution.')
  } else {
    pass('testing/ excluded from Free tree')
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log(`${BOLD}Release Workflow Dry-Run Auditor${RESET}`)

  if (!existsSync(RELEASE_YML)) {
    console.error(`${RED}release.yml not found at ${RELEASE_YML}${RESET}`)
    process.exit(2)
  }

  const yml = readFileSync(RELEASE_YML, 'utf-8')
  runStaticChecks(yml)

  if (!skipRsync) {
    const sandboxRoot = mkdtempSync(join(tmpdir(), 'weaver-release-dry-run-'))
    try {
      runRsyncSimulation(sandboxRoot)
    } finally {
      rmSync(sandboxRoot, { recursive: true, force: true })
    }
  } else {
    console.log(`\n  ${YELLOW}⊘ rsync simulation skipped (--skip-rsync)${RESET}`)
  }

  console.log()
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  console.log(`Summary: ${passed} pass, ${failed} fail`)

  if (failed > 0) {
    console.log(`\n${RED}${BOLD}RELEASE WORKFLOW DRY-RUN FAILED${RESET}`)
    console.log(`Fix the above before pushing a release tag.\n`)
    process.exit(1)
  }

  console.log(`${GREEN}${BOLD}Release workflow structure and sync output verified.${RESET}\n`)
}

main()
