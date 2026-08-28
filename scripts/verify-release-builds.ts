// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Release Builds Pre-Flight Auditor
 *
 * Simulates every downstream build path before a release tag is pushed. Catches
 * the class of bug where code works in Dev's monorepo layout but breaks when
 * transformed for downstream distribution (Free tarball flattening, Docker
 * image, demo builds).
 *
 * Why: our 30+ compliance auditors validate the Dev repo. None of them
 * exercise the transformations that produce downstream artifacts. v1.0.0
 * shipped with a prebuild that references `../scripts/delivery-projection.ts`
 * — a path that works in Dev's monorepo (`code/..` = project root with the
 * script) but escapes the repo on the flattened Free layout where no `../`
 * exists.
 *
 * Build contexts (each simulates a real downstream build path):
 *
 *   1. free-tarball — apply sync-exclude.yml + hard-coded excludes from
 *      sync-to-free.yml, flatten code/ → tmpdir/, run npm ci + build:all.
 *      Catches: relative-path escapes, missing-file references.
 *
 *   2. public-demo — Dev monorepo layout (no flattening) +
 *      VITE_DEMO_MODE=true VITE_DEMO_PUBLIC=true npm run build.
 *      Catches: public-demo-specific build regressions.
 *
 *   3. private-demo — Dev monorepo layout + VITE_DEMO_MODE=true npm run build.
 *      Catches: private-demo-specific build regressions.
 *
 * Weaver itself is NOT distributed as a Docker image — it's a NixOS module
 * that manages microvm@*.service units and br-microvm bridge networking at
 * host level. Running Weaver in a container would require --privileged or
 * Docker-in-Docker, either of which defeats the isolation model. Docker is
 * a workload Weaver MANAGES, not a shipping format for Weaver itself.
 *
 * Usage:
 *   npx tsx scripts/verify-release-builds.ts                  # all contexts
 *   npx tsx scripts/verify-release-builds.ts --context=free-tarball
 *   npx tsx scripts/verify-release-builds.ts --fast           # skip build:all,
 *                                                             # just validate
 *                                                             # npm ci succeeds
 *
 * Expected runtime: full suite ~8–15 minutes. Wired into test:prerelease,
 * not test:compliance (too slow for every push).
 */

import { readFileSync, existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')
const SYNC_EXCLUDE_YML = resolve(PROJECT_ROOT, '.github', 'sync-exclude.yml')

// ---------------------------------------------------------------------------
// ANSI
// ---------------------------------------------------------------------------

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const contextFilter = args.find((a) => a.startsWith('--context='))?.split('=')[1]
const fastMode = args.includes('--fast')

// ---------------------------------------------------------------------------
// Sync exclusion parsing
// ---------------------------------------------------------------------------

/**
 * Parse exclude paths from sync-exclude.yml. Matches the shell logic the
 * sync-to-free.yml workflow uses so our simulation is byte-equivalent.
 */
function readSyncExcludes(): string[] {
  const excludes: string[] = []
  if (!existsSync(SYNC_EXCLUDE_YML)) return excludes

  const content = readFileSync(SYNC_EXCLUDE_YML, 'utf-8')
  for (const rawLine of content.split('\n')) {
    const stripped = rawLine.replace(/#.*$/, '').trim()
    if (!stripped || stripped === 'exclude:') continue
    const path = stripped.replace(/^-\s*/, '').trim()
    if (!path) continue
    excludes.push(path)
  }
  return excludes
}

/**
 * Hard-coded base excludes from sync-to-free.yml (the rsync step). Kept in
 * sync with the workflow's literal --exclude flags.
 */
// NOTE: flake.nix + flake.lock are deliberately NOT excluded — sync-to-free.yml ships them to
// the Free root so users can install via a direct flake input (UPGRADE.md Path B, fixed
// 2026-04-21). They were listed here until 2026-08-27, four months out of step with the
// workflow this list claims to mirror, which meant the free-tarball context built a tree with
// no flake in it and could not have caught a nix-build regression even in principle.
const BASE_CODE_EXCLUDES = [
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
// Context definitions
// ---------------------------------------------------------------------------

interface BuildContext {
  id: string
  description: string
  /** Prepare a sandbox directory for this context and return its path. */
  prepare: (sandboxRoot: string) => string
  /** Run the build inside the prepared sandbox. Throw on failure. */
  build: (sandboxDir: string) => void
}

/**
 * Run a command with argv — no shell interpolation, no injection surface.
 * CodeQL's shell-command-injection rule flags `bash -c <string>` invocations
 * when any interpolated value comes from file I/O or env. Using argv arrays
 * with `shell: false` (the default) eliminates the surface entirely: argv
 * entries are passed to execve verbatim, no shell metacharacters interpreted.
 */
function run(argv: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): void {
  const [cmd, ...args] = argv
  const r = spawnSync(cmd, args, {
    cwd,
    env,
    stdio: 'pipe',
    encoding: 'utf-8',
  })
  if (r.status !== 0) {
    const tail = (r.stdout + r.stderr).split('\n').slice(-40).join('\n')
    throw new Error(`command failed (exit ${r.status}): ${argv.join(' ')}\n--- last 40 lines ---\n${tail}`)
  }
}

/**
 * Flatten code/ → sandbox/ applying sync-to-free exclusions. Mirrors the
 * rsync step in sync-to-free.yml: --exclude='.git' --exclude='testing/' etc.
 *
 * Exclude args are pushed into argv directly (one `--exclude=<path>` entry
 * per exclusion). No shell, no quoting required. A sync-exclude.yml entry
 * containing shell metacharacters (spaces, `;`, `$`, etc.) becomes a literal
 * rsync pattern rather than a command fragment.
 */
function flattenToFreeLayout(sandboxDir: string): void {
  mkdirSync(sandboxDir, { recursive: true })
  const allExcludes = [...BASE_CODE_EXCLUDES, ...readSyncExcludes()]

  // TRACKED FILES ONLY, then excludes — two steps, exactly as verify-free-tree.mjs's
  // simulate() does, and for the same reason. sync-to-free.yml rsyncs from a fresh
  // `actions/checkout`, which holds tracked files and nothing else. Sourcing the WORKING
  // TREE instead sweeps in every gitignored artifact, and a checker whose universe is
  // broader than its consumer's can only ever return green.
  //
  // Measured 2026-08-27: this function copied the gitignored src-pwa/package.json and its
  // 217-package src-pwa/node_modules into the sandbox, so Quasar's PWA step found its deps
  // pre-staged and never needed the network. The published tree has neither, and the nix
  // build of it had been failing since 2026-08-17 while this context stayed green.
  // Same defect published-tree.ts was written to fix (G-process-2026-07-21-01KYSBXCJ95C678S8YWKZZQ84M).
  //
  // rsync cannot do it in one pass: it does not apply exclude rules to a --files-from list.
  const staged = `${sandboxDir}.staged`
  mkdirSync(staged, { recursive: true })
  const ls = spawnSync('git', ['-C', CODE_ROOT, 'ls-files', '-z'], {
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (ls.status !== 0) throw new Error('git ls-files failed while staging the Free layout')
  const listFile = `${staged}.files.txt`
  writeFileSync(listFile, ls.stdout)

  run(['rsync', '-a', '--from0', `--files-from=${listFile}`, `${CODE_ROOT}/`, `${staged}/`], PROJECT_ROOT)
  run(
    [
      'rsync',
      '-a',
      '--delete',
      '--delete-excluded',
      ...allExcludes.map((p) => `--exclude=${p}`),
      // Trailing slashes matter — sources contents, not the directory itself.
      `${staged}/`,
      `${sandboxDir}/`,
    ],
    PROJECT_ROOT,
  )
  rmSync(staged, { recursive: true, force: true })
  rmSync(listFile, { force: true })
}

const CONTEXTS: BuildContext[] = [
  {
    id: 'free-tarball',
    description: 'Weaver-Free tarball — sync-flattened layout, npm ci + build:all',
    prepare: (sandboxRoot) => {
      const dir = join(sandboxRoot, 'free-tarball')
      flattenToFreeLayout(dir)
      return dir
    },
    build: (dir) => {
      run(['npm', 'ci'], dir)
      if (!fastMode) {
        // VITE_FREE_BUILD=true tells routes.ts to strip paid-tier route imports
        // (which reference sync-excluded files). Matches the env Free releases
        // build under; any regression makes this context fail.
        run(['npm', 'run', 'build:all'], dir, { ...process.env, VITE_FREE_BUILD: 'true' })
      }
    },
  },
  {
    id: 'public-demo',
    description: 'Public demo — Dev monorepo layout, VITE_DEMO_MODE + VITE_DEMO_PUBLIC',
    prepare: (sandboxRoot) => {
      const dir = join(sandboxRoot, 'public-demo')
      // Copy code/ as-is (monorepo layout) to avoid touching the working tree's node_modules.
      mkdirSync(dir, { recursive: true })
      run(
        ['rsync', '-a', '--exclude=node_modules/', '--exclude=dist/', '--exclude=.quasar/', `${CODE_ROOT}/`, `${dir}/`],
        PROJECT_ROOT,
      )
      return dir
    },
    build: (dir) => {
      run(['npm', 'ci'], dir)
      if (fastMode) return
      run(['npm', 'run', 'build'], dir, { ...process.env, VITE_DEMO_MODE: 'true', VITE_DEMO_PUBLIC: 'true' })
    },
  },
  {
    id: 'private-demo',
    description: 'Private demo — Dev monorepo layout, VITE_DEMO_MODE only',
    prepare: (sandboxRoot) => {
      const dir = join(sandboxRoot, 'private-demo')
      mkdirSync(dir, { recursive: true })
      run(
        ['rsync', '-a', '--exclude=node_modules/', '--exclude=dist/', '--exclude=.quasar/', `${CODE_ROOT}/`, `${dir}/`],
        PROJECT_ROOT,
      )
      return dir
    },
    build: (dir) => {
      run(['npm', 'ci'], dir)
      if (fastMode) return
      run(['npm', 'run', 'build'], dir, { ...process.env, VITE_DEMO_MODE: 'true' })
    },
  },
]

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

interface Result {
  context: string
  status: 'pass' | 'fail' | 'skipped'
  durationMs: number
  detail?: string
}

function runContext(ctx: BuildContext, sandboxRoot: string): Result {
  const start = Date.now()
  try {
    const dir = ctx.prepare(sandboxRoot)
    ctx.build(dir)
    return { context: ctx.id, status: 'pass', durationMs: Date.now() - start }
  } catch (err) {
    return {
      context: ctx.id,
      status: 'fail',
      durationMs: Date.now() - start,
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

function main(): void {
  const targets = contextFilter
    ? CONTEXTS.filter((c) => c.id === contextFilter)
    : CONTEXTS

  if (targets.length === 0) {
    console.error(`${RED}No matching context: ${contextFilter}${RESET}`)
    console.error(`Available: ${CONTEXTS.map((c) => c.id).join(', ')}`)
    process.exit(2)
  }

  const sandboxRoot = mkdtempSync(join(tmpdir(), 'weaver-release-audit-'))
  console.log(`${BOLD}Release Builds Pre-Flight${RESET}`)
  console.log(`${DIM}Sandbox: ${sandboxRoot}${RESET}`)
  if (fastMode) console.log(`${YELLOW}Fast mode — validating npm ci only, skipping build${RESET}`)
  console.log()

  const results: Result[] = []
  try {
    for (const ctx of targets) {
      console.log(`${BOLD}[${ctx.id}]${RESET} ${ctx.description}`)
      const r = runContext(ctx, sandboxRoot)
      results.push(r)
      const secs = (r.durationMs / 1000).toFixed(1)
      if (r.status === 'pass') console.log(`  ${GREEN}\u2713${RESET} pass ${DIM}(${secs}s)${RESET}`)
      else if (r.status === 'skipped') console.log(`  ${YELLOW}\u25CB${RESET} skipped — ${r.detail}`)
      else {
        console.log(`  ${RED}\u2717${RESET} fail ${DIM}(${secs}s)${RESET}`)
        console.log(`\n${r.detail?.split('\n').map((l) => '    ' + l).join('\n') ?? ''}\n`)
      }
    }
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true })
  }

  console.log()
  const passed = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  console.log(`Summary: ${passed} pass, ${failed} fail, ${skipped} skipped`)
  if (failed > 0) {
    console.log(`\n${RED}${BOLD}RELEASE BUILDS AUDIT FAILED${RESET}`)
    console.log(`Fix the failing context(s) before pushing a release tag.`)
    process.exit(1)
  }
  console.log(`${GREEN}${BOLD}All release build contexts pass.${RESET}`)
}

main()
