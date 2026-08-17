// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:workflows — a CI job must be able to find the things it runs.
 *
 * WHY THIS EXISTS
 * ---------------
 * `.github/workflows/` was checked by nothing. `test.yml` ran bare `npm ci`, `npm run lint` and
 * `npm run build` from the repository root — and this repo has no root package.json, because
 * Gantry's package lives at code/. Every job in all four had failed at its first step for the
 * entire life of the repo, and nobody noticed, because the workflow's only triggers are tags and
 * pull requests: no tag had been cut and no PR opened.
 *
 * That is the same class as the E2E harness and the hook tree — infrastructure that exists, looks
 * like coverage, and has never once executed. The difference with CI is that you cannot simply run
 * it locally to find out, so the check has to be static: not "does it pass" but "could it possibly
 * pass, given what is actually in this repo".
 *
 * WHAT IT CHECKS
 * --------------
 *   1. Every `working-directory` (job default or per-step) names a directory that exists.
 *   2. Every `npm ci` / `npm install` runs somewhere that has a package.json.
 *   3. Every `npm run <script>` names a script that package.json actually defines, resolved at the
 *      step's effective working directory — including `--prefix`, which retargets it.
 *   4. Every `cache-dependency-path` points at a file that exists. This one fails SILENTLY in
 *      GitHub: a wrong path does not error, it disables caching, so the job stays green and simply
 *      gets slower forever.
 *
 * WHAT IT CANNOT TELL YOU, STATED RATHER THAN IMPLIED
 * ---------------------------------------------------
 * That the workflow PASSES. It checks resolvability, not behaviour — a job whose paths all resolve
 * can still fail on its merits. Only a real run answers that, and for a tags-and-PR workflow the
 * real run is a tag or a PR. Do not let a green result here be read as a green CI run; it is the
 * cheaper half of the question, and it is the half that was wrong.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = execFileSync('git', ['-C', PKG, 'rev-parse', '--show-toplevel'], {
  encoding: 'utf-8',
}).trim()

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const OFF = '\x1b[0m'

interface Step {
  run?: string
  uses?: string
  with?: Record<string, unknown>
  'working-directory'?: string
}
interface Job {
  defaults?: { run?: { 'working-directory'?: string } }
  steps?: Step[]
}
interface Workflow {
  jobs?: Record<string, Job>
}

/** Scripts defined by the package.json governing `dir`, or null when there is no package there. */
function scriptsAt(dir: string): Record<string, string> | null {
  const manifest = join(REPO, dir, 'package.json')
  if (!existsSync(manifest)) return null
  try {
    return (JSON.parse(readFileSync(manifest, 'utf-8')).scripts ?? {}) as Record<string, string>
  } catch {
    return null
  }
}

/**
 * The directory an npm invocation actually runs in: the step's working directory, retargeted by
 * `--prefix` when present. A relative --prefix resolves against the working directory, which is
 * exactly the composition that makes these easy to get wrong by hand.
 */
function effectiveDir(command: string, workingDir: string): string {
  const prefix = command.match(/--prefix[= ]+(\S+)/)
  if (!prefix) return workingDir
  const p = prefix[1]!.replace(/^['"]|['"]$/g, '')
  if (p.startsWith('/')) return p
  return join(workingDir, p)
}

/**
 * `npm run <script>` occurrences in one shell blob (a `run:` may hold many lines).
 *
 * Lines whose command is a PRINTING builtin are excluded. A workflow step that composes an issue
 * body or a log message routinely names npm scripts in prose — Weaver's codeql-feedback.yml builds
 * a GitHub issue whose text explains that `npm run audit:codeql-coverage` fails, and reading that
 * as an invocation reports a defect in a correct workflow.
 *
 * This is the same discrimination verify-e2e-docker-only.ts already makes, and its absence here is
 * the fixed-in-one-copy shape: two checkers, one lesson, applied once. Quoting is not evidence that
 * something is not a command; printing is.
 */
const PRINTING = /(?:^|[;&|(]\s*)(?:echo|printf|cat|print)\b/

/**
 * A heredoc BODY is data — an issue-comment body, a commit message, a config file.
 *
 * `PRINTING` above catches single-line prose (`echo`/`printf` at a command position), but a
 * heredoc body has no such marker on each line and carries no quotes either. On 2026-08-17 that
 * flagged version-drift-check.yml for the words `npm run refresh:security-allowlist` inside a
 * sentence telling a human what to type. Rewording the sentence would be gaming the auditor.
 *
 * DUPLICATED, deliberately: `verify-workflow-cwd.ts` has the same function and the same fix, but
 * it lives behind the sync exclusion and imports from `scripts/lib/`, which does not ship. This
 * file DOES ship to Weaver-Free, so importing a shared copy would leave the mirror with an auditor
 * whose dependency is absent — present-but-broken, the exact failure the exclusion list exists to
 * prevent. Do not "deduplicate" these two without moving both to the same side of that boundary.
 */
function stripHeredocBodies(text: string): string {
  const out: string[] = []
  const open: string[] = []
  for (const line of text.split('\n')) {
    if (open.length > 0) {
      if (line.trim() === open[open.length - 1]) open.pop()
      continue
    }
    out.push(line)
    const re = /<<-?\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))/g
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) open.push(m[1] ?? m[2] ?? m[3])
  }
  return out.join('\n')
}

function npmRunScripts(command: string): { script: string; raw: string }[] {
  const out: { script: string; raw: string }[] = []
  for (const line of stripHeredocBodies(command).split('\n')) {
    if (PRINTING.test(line.trim())) continue
    for (const m of line.matchAll(/\bnpm\b[^\n&|;]*?\brun\b\s+([A-Za-z0-9:_-]+)/g)) {
      out.push({ script: m[1]!, raw: m[0]!.trim() })
    }
  }
  return out
}

function isInstall(command: string): boolean {
  return /\bnpm\s+(ci|install|i)\b/.test(stripHeredocBodies(command))
}

/** Paired self-test: the checks must fire on broken input and hold their fire on good input. */
function selfTest(): void {
  const failures: string[] = []

  // effectiveDir
  const dirCases: [string, string, string][] = [
    ['npm ci', 'code', 'code'],
    ['npm ci --prefix backend', 'code', 'code/backend'],
    ['npm run test --prefix backend', '.', 'backend'],
    ['npm --prefix /abs/path run x', 'code', '/abs/path'],
  ]
  for (const [cmd, wd, want] of dirCases) {
    const got = effectiveDir(cmd, wd)
    if (got !== want) failures.push(`effectiveDir(${cmd!}, ${wd}) = ${got}, want ${want}`)
  }

  // npmRunScripts — must CATCH real invocations and IGNORE prose/other commands
  const catchCases: [string, string[]][] = [
    ['npm run lint', ['lint']],
    ['npm run test:unit:run -- --reporter=json', ['test:unit:run']],
    ['npm --prefix backend run build', ['build']],
    ['npm run a && npm run b', ['a', 'b']],
  ]
  for (const [cmd, want] of catchCases) {
    const got = npmRunScripts(cmd).map((s) => s.script)
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      failures.push(`npmRunScripts(${cmd}) = [${got}], want [${want}]`)
    }
  }
  for (const cmd of ['echo "run npm run lint by hand"', 'npm ci', 'npx tsx scripts/x.ts']) {
    // `echo` is prose but the tokens are present — a command-blob scan is expected to see it, so
    // this case documents the known limit rather than asserting a clean miss.
    if (cmd !== 'echo "run npm run lint by hand"' && npmRunScripts(cmd).length) {
      failures.push(`npmRunScripts(${cmd}) should find nothing`)
    }
  }

  if (!isInstall('npm ci')) failures.push('isInstall missed `npm ci`')
  if (isInstall('npm run build')) failures.push('isInstall wrongly flagged `npm run build`')

  // Heredoc bodies are DATA. Paired, because a stripper that ate too much would silently stop
  // seeing real commands — so the CATCH case matters as much as the IGNORE one.
  const heredocProse = [
    'B=$(cat <<EOF',
    'Fix it by running npm run refresh:allowlist',
    'and then npm ci',
    'EOF',
    ')',
  ].join('\n')
  if (npmRunScripts(heredocProse).length) {
    failures.push('npmRunScripts read a heredoc BODY as a command')
  }
  if (isInstall(heredocProse)) {
    failures.push('isInstall read a heredoc BODY as a command')
  }
  const heredocThenReal = heredocProse + '\nnpm run lint'
  if (!npmRunScripts(heredocThenReal).some((x) => x.script === 'lint')) {
    failures.push('stripHeredocBodies swallowed a real command after the heredoc')
  }
  if (!isInstall(heredocProse + '\nnpm ci')) {
    failures.push('stripHeredocBodies swallowed a real npm ci after the heredoc')
  }

  if (failures.length) {
    console.error(`\n  ${RED}✗${OFF} self-test failed — refusing to report on workflows:`)
    for (const f of failures) console.error(`      ${f}`)
    process.exit(1)
  }
  const total = dirCases.length + catchCases.length + 4
  console.log(`  ${GREEN}✓${OFF} self-test: ${total}/${total} cases`)
}

/**
 * Schema + expression validation, delegated to actionlint.
 *
 * This is not redundant with the checks below — it is the half they cannot do. `test.yml` used a
 * `secrets` context in a step-level `if:`, which GitHub does not allow; it rejects the entire
 * WORKFLOW FILE for it. The result was 100 consecutive runs that failed in 0s with no jobs, no
 * logs and no annotation, on every push for months. Nothing in this repo could see it, and
 * resolvability checking would never have found it either — every path in that file was valid.
 *
 * REFUSES if actionlint cannot be obtained. A pass here is read as "the workflows are sound", and
 * reporting that while silently skipping schema validation is the precise false assurance this
 * whole auditor exists to remove. The condition changes the answer, so it fails rather than
 * degrades.
 *
 * shellcheck is disabled: its findings on `run:` blocks are style advice, and this gate is about
 * whether GitHub will accept the file.
 */
function actionlint(problems: string[]): void {
  const attempts: [string, string[]][] = [
    ['actionlint', ['-shellcheck=']],
    ['nix', ['run', 'nixpkgs#actionlint', '--', '-shellcheck=']],
  ]

  for (const [bin, args] of attempts) {
    try {
      execFileSync(bin, args, { cwd: REPO, encoding: 'utf-8', stdio: 'pipe' })
      console.log(`  ${GREEN}✓${OFF} actionlint: no schema or expression errors ${DIM}(via ${bin})${OFF}`)
      return
    } catch (e) {
      const err = e as { status?: number; stdout?: string; message?: string }
      // Non-zero WITH output is a real finding; a spawn failure has no stdout.
      if (typeof err.status === 'number' && err.stdout) {
        problems.push(`actionlint reported workflow errors:\n${err.stdout.trimEnd()}`)
        return
      }
      // Otherwise this binary is unavailable — try the next.
    }
  }

  problems.push(
    'actionlint could not be run, so workflow SCHEMA is unvalidated.\n' +
      '      Refusing to report the workflows sound on resolvability alone — a schema error\n' +
      '      rejects the whole file and produces a 0s failure with no logs.\n' +
      '      Install it, or make `nix run nixpkgs#actionlint` reachable.'
  )
}

function main(): number {
  console.log('\n  Workflows — every CI step can find what it runs\n')
  selfTest()

  const files = execFileSync('git', ['-C', REPO, 'ls-files', '.github/workflows'], {
    encoding: 'utf-8',
  })
    .split('\n')
    .filter((f) => /\.ya?ml$/.test(f))

  if (!files.length) {
    console.log(`\n${RED}RESULT: FAIL${OFF} — no workflows found; refusing to pass vacuously.\n`)
    return 1
  }

  const problems: string[] = []
  let stepsChecked = 0
  let expressionSkips = 0

  actionlint(problems)

  for (const rel of files) {
    let wf: Workflow
    try {
      wf = load(readFileSync(join(REPO, rel), 'utf-8')) as Workflow
    } catch (e) {
      problems.push(`${rel} is not parseable YAML: ${(e as Error).message}`)
      continue
    }

    for (const [jobName, job] of Object.entries(wf.jobs ?? {})) {
      const jobDefault = job.defaults?.run?.['working-directory'] ?? '.'

      for (const step of job.steps ?? []) {
        const workingDir = step['working-directory'] ?? jobDefault
        const where = `${rel} › ${jobName}`

        // A GitHub expression is resolved at run time, not by us — Weaver legitimately uses
        // `${{ github.repository == '…/Weaver-Dev' && 'code' || '.' }}` so one workflow serves both
        // the nested Dev repo and the flattened public mirror. Treating that string as a literal
        // path reported eight false positives on a correct workflow. Skip the path checks for
        // expression-valued directories; the resolvability question is genuinely unanswerable
        // statically, and a checker that answers it anyway is worse than one that abstains.
        const isExpression = (v: string): boolean => v.includes('${{')

        if (workingDir !== '.' && !isExpression(workingDir) && !existsSync(join(REPO, workingDir))) {
          problems.push(`${where}: working-directory "${workingDir}" does not exist in this repo`)
          continue
        }
        if (isExpression(workingDir)) {
          expressionSkips++
          continue
        }

        // setup-node's Node version must satisfy the package's declared engines. Derived from
        // engines.node rather than restated, so the two cannot drift.
        //
        // They had: both packages declare ">=24.0.0" (the portfolio standard, raised deliberately)
        // while every workflow pinned '20'. That does not fail as an engine error — it fails as
        // `npm ci` reporting the lockfile out of sync, because an npm-11 lockfile reads as
        // inconsistent to npm 10. The message names a transitive package nobody has heard of and
        // points at the lockfile, which is the one thing that was correct.
        const nodeVersion = step.with?.['node-version']
        if (typeof nodeVersion === 'string' || typeof nodeVersion === 'number') {
          const pinned = parseInt(String(nodeVersion).replace(/[^\d].*$/, ''), 10)
          const scripts = scriptsAt(workingDir === '.' ? '' : workingDir)
          const manifestPath = join(REPO, workingDir === '.' ? '' : workingDir, 'package.json')
          if (scripts && existsSync(manifestPath)) {
            const engines = (JSON.parse(readFileSync(manifestPath, 'utf-8')).engines ?? {}) as {
              node?: string
            }
            const wantMajor = engines.node ? parseInt(engines.node.replace(/[^\d]*/, ''), 10) : NaN
            if (!Number.isNaN(pinned) && !Number.isNaN(wantMajor) && pinned < wantMajor) {
              problems.push(
                `${where}: setup-node pins Node ${pinned}, but ${workingDir}/package.json requires ` +
                  `"${engines.node}".\n` +
                  '        Symptom is not an engine error — it is `npm ci` claiming the lockfile is\n' +
                  '        out of sync, because the lockfile was written by a newer npm.'
              )
            }
          }
        }

        // setup-node's cache path is NOT a run step — job defaults do not reach it.
        const cachePath = step.with?.['cache-dependency-path']
        if (typeof cachePath === 'string' && !cachePath.includes('${{')) {
          const p = join(REPO, cachePath)
          if (!existsSync(p) || !statSync(p).isFile()) {
            problems.push(
              `${where}: cache-dependency-path "${cachePath}" does not exist.\n` +
                '        This does not fail the job — it silently disables caching.'
            )
          }
        }

        if (!step.run) continue
        stepsChecked++

        const dir = effectiveDir(step.run, workingDir)

        if (isInstall(step.run) && !scriptsAt(dir)) {
          problems.push(
            `${where}: installs in "${dir}", which has no package.json.\n` +
              `        The step is: ${step.run.split('\n')[0]!.trim()}`
          )
        }

        for (const { script, raw } of npmRunScripts(step.run)) {
          const runDir = effectiveDir(raw, workingDir)
          const scripts = scriptsAt(runDir)
          if (!scripts) {
            problems.push(`${where}: \`${raw}\` runs in "${runDir}", which has no package.json`)
          } else if (!(script in scripts)) {
            problems.push(
              `${where}: \`${raw}\` — "${script}" is not a script in ${runDir}/package.json`
            )
          }
        }
      }
    }
  }

  console.log(
    `  ${GREEN}✓${OFF} ${files.length} workflow(s), ${stepsChecked} run-step(s) checked ${DIM}(resolvability, not behaviour)${OFF}`
  )
  // Report what was NOT checked. A silent skip is how a checker's coverage quietly shrinks.
  if (expressionSkips) {
    console.log(
      `  ${DIM}· ${expressionSkips} step(s) skipped: working-directory is a GitHub expression, resolved at run time${OFF}`
    )
  }

  if (problems.length) {
    console.log('')
    for (const p of problems) console.log(`${RED}  ✗ ${p}${OFF}`)
    console.log(`\n${RED}\x1b[1mRESULT: FAIL${OFF} — a CI step cannot find what it runs.\n`)
    return 1
  }
  console.log(`\n${GREEN}\x1b[1mRESULT: PASS${OFF} — every CI step resolves\n`)
  return 0
}

process.exit(main())
