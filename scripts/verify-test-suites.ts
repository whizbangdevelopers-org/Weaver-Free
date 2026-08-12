// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:test-suites — a package that declares a test runner must have something to run.
 *
 * WHY THIS EXISTS
 * ---------------
 * `vitest run` exits 1 on an empty suite. That is the correct behaviour and a terrible signal: the
 * failure text is `No test files found, exiting with code 1`, which is indistinguishable at a
 * glance from a real test failure, and it arrives in CI rather than locally. A package can
 * therefore declare a test script, have zero specs, and present as "tests failing" forever.
 *
 * Measured 2026-08-12: this template's backend did exactly that, so every generated project began
 * life with a red Backend Tests job. This repo's own test.yml had 193 consecutive failures that
 * nobody examined — a red run that has always been red carries no information, and the first thing
 * a new project learns from a red scaffold is that red is normal.
 *
 * WHY A STARTER TEST WAS NOT ENOUGH
 * ---------------------------------
 * The immediate fix was to ship a starter spec. That is an INSTANCE fix: a test file is not a
 * control. It is precisely the kind of file a new project deletes or replaces first, and deleting
 * it silently restores the original condition. This is the control — it fails at compliance time,
 * on the developer's machine, before CI is involved.
 *
 * NOT `--passWithNoTests`
 * -----------------------
 * That flag converts a true signal into silence, which is gaming the checker rather than fixing
 * the input (~/.claude/rules/never-game-auditors.md). "This package has no tests" is worth knowing.
 * The complaint was never that it was reported — only that it was reported late, and in a form
 * that read as something else.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = execFileSync('git', ['-C', PKG, 'rev-parse', '--show-toplevel'], {
  encoding: 'utf-8',
}).trim()

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const OFF = '\x1b[0m'

/** A script that invokes a test runner which fails on an empty suite. */
function declaresRunner(scripts: Record<string, string>): string | null {
  for (const [name, body] of Object.entries(scripts)) {
    if (!/^test(:|$)/.test(name)) continue
    if (/\bvitest\b/.test(body)) return `${name}: ${body}`
  }
  return null
}

/** Spec files under a directory, ignoring node_modules and build output. */
function countSpecs(dir: string): number {
  let n = 0
  const walk = (d: string, depth: number): void => {
    if (depth > 6) return
    let entries: string[]
    try {
      entries = readdirSync(d)
    } catch {
      return
    }
    for (const e of entries) {
      if (e === 'node_modules' || e === 'dist' || e === '.git' || e === 'coverage') continue
      const full = join(d, e)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) walk(full, depth + 1)
      else if (/\.(spec|test)\.[cm]?[jt]sx?$/.test(e)) n++
    }
  }
  walk(dir, 0)
  return n
}

/** Paired self-test: the predicate must fire on a runner declaration and hold fire otherwise. */
function selfTest(): void {
  const cases: [Record<string, string>, boolean][] = [
    [{ test: 'vitest run' }, true],
    [{ 'test:unit': 'vitest' }, true],
    [{ 'test:unit:run': 'vitest run --coverage' }, true],
    [{ test: 'echo "no tests"' }, false],
    [{ build: 'vitest run' }, false], // not a test:* script
    [{ 'test:e2e': 'playwright test' }, false], // e2e-docker-only-ignore: fixture; playwright passes on an empty suite
    [{}, false],
  ]
  const failures = cases
    .filter(([scripts, want]) => Boolean(declaresRunner(scripts)) !== want)
    .map(([scripts, want]) => `${JSON.stringify(scripts)} expected ${want}`)

  if (failures.length) {
    console.error(`\n  ${RED}✗${OFF} self-test failed — refusing to report:`)
    for (const f of failures) console.error(`      ${f}`)
    process.exit(1)
  }
  console.log(`  ${GREEN}✓${OFF} self-test: ${cases.length}/${cases.length} cases`)
}

function main(): number {
  console.log('\n  Test suites — a declared runner must have something to run\n')
  selfTest()

  const manifests = execFileSync('git', ['-C', REPO, 'ls-files', '*package.json'], {
    encoding: 'utf-8',
  })
    .split('\n')
    .filter(Boolean)
    .filter((p) => !p.includes('node_modules'))

  const problems: string[] = []
  let checked = 0

  for (const rel of manifests) {
    const abs = join(REPO, rel)
    if (!existsSync(abs)) continue
    let scripts: Record<string, string>
    try {
      scripts = (JSON.parse(readFileSync(abs, 'utf-8')).scripts ?? {}) as Record<string, string>
    } catch {
      continue
    }
    const decl = declaresRunner(scripts)
    if (!decl) continue

    checked++
    const dir = dirname(abs)
    const specs = countSpecs(dir)
    if (specs === 0) {
      problems.push(
        `${relative(REPO, dir) || '.'} declares a test runner but has ZERO spec files.\n` +
          `        script — ${decl}\n` +
          '        vitest exits 1 on an empty suite, so this presents in CI as a test FAILURE.\n' +
          '        Write a test. Do not add --passWithNoTests: the report is not the problem.'
      )
    } else {
      console.log(`  ${GREEN}✓${OFF} ${relative(REPO, dir) || '.'} ${DIM}— ${specs} spec file(s)${OFF}`)
    }
  }

  // A repo where NO package declares vitest is a legitimate pass — anvil and the nixos template
  // are Nix repos with no JS suites at all. The vacuity risk this guards against is the scan
  // finding nothing because it is misconfigured, so assert on the MANIFEST scan instead: if not a
  // single package.json was found, the auditor is broken, not the repo.
  if (!manifests.length) {
    console.log(`\n${RED}RESULT: FAIL${OFF} — no package.json found at all; the scan is broken, not the repo.\n`)
    return 1
  }
  if (!checked) {
    console.log(
      `  ${GREEN}✓${OFF} ${manifests.length} package(s) scanned; none declares a vitest runner ${DIM}(nothing to check)${OFF}`
    )
  }

  if (problems.length) {
    console.log('')
    for (const p of problems) console.log(`${RED}  ✗ ${p}${OFF}`)
    console.log(`\n${RED}\x1b[1mRESULT: FAIL${OFF} — a package would report "no tests" as a failure.\n`)
    return 1
  }
  console.log(`\n${GREEN}\x1b[1mRESULT: PASS${OFF} — ${checked} package(s) with a runner, all have specs\n`)
  return 0
}

process.exit(main())
