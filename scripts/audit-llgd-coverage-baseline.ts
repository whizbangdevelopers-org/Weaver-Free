// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Proprietary and confidential. Do not distribute.
/**
 * LLGD Coverage Baseline — one-shot read-only script
 *
 * Measures: what fraction of historical CodeQL findings on Weaver-Free
 * produced a corresponding `llgd` entry in LESSONS-LEARNED.md or
 * KNOWN-GOTCHAS.md? The answer is the "before" half of a before/after
 * comparison that v1.0.4's Semgrep + Tier-1 coverage-gap detector will
 * complete. Without this baseline, any future measurement of LLM-draft
 * automation has nothing to compare against.
 *
 * Scope:
 *   - Read-only. Does not modify LESSONS-LEARNED, KNOWN-GOTCHAS, or any
 *     tracked source.
 *   - One-shot. Emits JSON + human-readable Markdown under code/reports/.
 *   - Not wired into any auditor chain (that's v1.0.4).
 *
 * Inputs:
 *   1. CodeQL alert history on Weaver-Free (all states — open, dismissed,
 *      fixed, auto_dismissed) via `gh api --paginate`.
 *   2. Git history of LESSONS-LEARNED.md + KNOWN-GOTCHAS.md (all authors,
 *      follow renames) + the committed diff of each commit.
 *
 * Matching heuristic (simple first — iterate if noisy):
 *   For each CodeQL alert `{rule, created_at, fixed_at, file, line}`:
 *     1. Window = [created_at - 3 days, fixed_at + 7 days]
 *        (if fixed_at null → created_at + 30 days)
 *     2. Topic match: full-text search each in-window commit's diff for
 *        (a) the CodeQL rule short name, (b) the alert's file path, or
 *        (c) any keyword from a small rule→keywords table.
 *     3. Classify:
 *          captured  — at least one window + topic match
 *          missed    — no commits in window, or commits but no topic match
 *          ambiguous — commits in window, none topic-matched (human review)
 *
 * Spec: plans/v1.0.2/LLGD-BACKFILL-SPEC.md
 * Output: code/reports/llgd-coverage-baseline.{json,md}
 *
 * Invocation:
 *   npx tsx scripts/audit-llgd-coverage-baseline.ts
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const FREE_REPO = 'whizbangdevelopers-org/Weaver-Free'
const LESSONS_PATH = 'code/docs/development/LESSONS-LEARNED.md'
const GOTCHAS_PATH = 'code/docs/development/KNOWN-GOTCHAS.md'
const REPORTS_DIR = resolve(CODE_ROOT, 'reports')
const JSON_OUT = resolve(REPORTS_DIR, 'llgd-coverage-baseline.json')
const MD_OUT = resolve(REPORTS_DIR, 'llgd-coverage-baseline.md')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CodeQLAlert {
  number: number
  rule: string          // short rule id, e.g. "js/path-injection"
  state: string         // open | dismissed | fixed | auto_dismissed
  file: string          // path reported by the alert (may be empty for meta alerts)
  line: number | null
  created_at: string    // ISO-8601
  fixed_at: string | null
  severity: string      // error | warning | note
}

interface LlgdCommit {
  sha: string
  date: string          // ISO-8601
  subject: string
  diff: string          // full diff of LESSONS-LEARNED + KNOWN-GOTCHAS changes at this commit
}

type Classification = 'captured' | 'missed' | 'ambiguous'

interface AlertMatch {
  alert: CodeQLAlert
  classification: Classification
  matchedCommits: { sha: string; subject: string; matchedOn: string[] }[]
  inWindowCommits: { sha: string; subject: string }[]  // commits in time window but not topic-matched
}

// ---------------------------------------------------------------------------
// CodeQL rule → keywords table
// Maintained inline; extend as new rule classes appear on Weaver-Free.
// The rule's short name is always searched automatically — this table only
// adds synonyms/related terms that might appear in an llgd write-up instead
// of the literal rule id.
// ---------------------------------------------------------------------------

const RULE_KEYWORDS: Record<string, string[]> = {
  'js/shell-command-injection-from-environment': ['shell injection', 'spawnSync', 'bash -c', 'argv'],
  'js/command-line-injection': ['command injection', 'execFile', 'shell: true'],
  'js/path-injection': ['path traversal', 'path.join', 'directory traversal'],
  'js/unvalidated-dynamic-method-call': ['dynamic method', 'bracket notation'],
  'js/code-injection': ['code injection', 'eval', 'Function constructor'],
  'js/xss': ['xss', 'innerHTML', 'v-html', 'cross-site scripting'],
  'js/reflected-xss': ['reflected xss', 'innerHTML', 'v-html'],
  'js/stored-xss': ['stored xss', 'innerHTML'],
  'js/sql-injection': ['sql injection', 'parameterized query'],
  'js/redos': ['redos', 'catastrophic backtracking', 'nested quantifier', 'safe-regex'],
  'js/polynomial-redos': ['redos', 'polynomial', 'backtracking'],
  'js/file-system-race': ['toctou', 'time of check', 'race condition', 'existsSync', 'readFile'],
  'js/insecure-temporary-file': ['insecure temp', 'mkdtemp', 'predictable tmp', 'symlink'],
  'js/http-to-file-access': ['http to file', 'network to disk', 'ssrf', 'download to file'],
  'js/server-side-unvalidated-redirect': ['open redirect', 'redirect', 'validated redirect'],
  'js/log-injection': ['log injection', 'logger', 'structured logging', 'sanitize log'],
  'js/regex-injection': ['regex injection', 'user-controlled regex'],
  'js/incomplete-sanitization': ['sanitization', 'escape', 'metacharacter'],
  'js/incomplete-url-substring-sanitization': ['url sanitization', 'url parse'],
  'js/unused-local-variable': ['unused variable', 'unused import', 'dead code'],
  'js/use-before-declaration': ['use before declaration', 'vi.hoisted', 'tdz', 'temporal dead zone'],
  'js/trivial-conditional': ['trivial conditional', 'dead branch', 'always true', 'always false'],
  'js/useless-assignment-to-local': ['useless assignment', 'dead store'],
  'js/prototype-pollution': ['prototype pollution', '__proto__', 'constructor.prototype'],
  'js/unsafe-jquery-plugin': ['jquery', 'unsafe plugin'],
  'js/unsafe-deserialization': ['deserialization', 'yaml load', 'xml2js', 'jsload'],
  'js/weak-cryptographic-algorithm': ['weak crypto', 'md5', 'sha1', 'aes-ecb', 'createCipher'],
  'js/insufficient-key-size': ['key size', 'weak key'],
  'js/insecure-randomness': ['insecure random', 'math.random', 'crypto.randomUUID'],
  'js/missing-token-validation': ['jwt', 'algorithm confusion', 'algorithms:'],
  'js/hardcoded-credentials': ['hardcoded', 'credentials', 'api key', 'secret'],
  'js/zipslip': ['zip slip', 'zip-slip', 'archive extraction', 'path.normalize'],
  // Scorecard meta-findings (aspirational grades, not code bugs) — classify as
  // "meta" rather than missed. Matching keywords ensure any CII / Scorecard
  // discussion in llgd gets credit.
  VulnerabilitiesID: ['vulnerabilities', 'npm audit', 'scorecard'],
  SASTID: ['sast', 'static analysis', 'codeql', 'scorecard'],
  MaintainedID: ['maintained', 'scorecard', 'activity'],
  FuzzingID: ['fuzz', 'scorecard', 'oss-fuzz'],
  CodeReviewID: ['code review', 'scorecard', 'second reviewer', 'compensating control'],
  TokenPermissionsID: ['token permissions', 'github-token', 'read-all', 'scorecard'],
  PinnedDependenciesID: ['pinned dependencies', 'npm ci', 'sha-pin', 'scorecard'],
  'SignedReleasesID': ['signed releases', 'cosign', 'sigstore', 'attestation', 'scorecard'],
  'SecurityPolicyID': ['security policy', 'security.md', 'scorecard'],
  'DependencyUpdateToolID': ['dependabot', 'renovate', 'scorecard'],
  'LicenseID': ['license', 'spdx', 'scorecard'],
  'BranchProtectionID': ['branch protection', 'scorecard'],
  'CI-TestsID': ['ci tests', 'github actions', 'scorecard'],
  'BinaryArtifactsID': ['binary artifact', 'scorecard'],
  'DangerousWorkflowID': ['dangerous workflow', 'scorecard'],
  'WebhooksID': ['webhook', 'scorecard'],
  'PackagingID': ['packaging', 'nur', 'scorecard'],
  'ContributorsID': ['contributors', 'scorecard'],
}

// Meta-finding rule IDs — Scorecard grades, not code bugs. Reported
// separately so they don't dilute the real-finding capture rate.
const META_RULES = new Set([
  'VulnerabilitiesID', 'SASTID', 'MaintainedID', 'FuzzingID', 'CodeReviewID',
  'TokenPermissionsID', 'PinnedDependenciesID', 'SignedReleasesID',
  'SecurityPolicyID', 'DependencyUpdateToolID', 'LicenseID',
  'BranchProtectionID', 'CI-TestsID', 'BinaryArtifactsID',
  'DangerousWorkflowID', 'WebhooksID', 'PackagingID', 'ContributorsID',
])

// ---------------------------------------------------------------------------
// IO helpers
// ---------------------------------------------------------------------------

function sh(args: string[], cwd: string = PROJECT_ROOT): string {
  return execFileSync(args[0], args.slice(1), {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,  // 64 MiB — alert list + diffs can be chunky
  })
}

function fetchCodeQLAlerts(): CodeQLAlert[] {
  // --paginate exhausts all pages. States enumerated so we get both open and
  // resolved alerts. GitHub defaults to `state=open` only; we need the full
  // history to compute the capture rate over time.
  const raw = sh([
    'gh', 'api', '--paginate',
    `repos/${FREE_REPO}/code-scanning/alerts?state=open,dismissed,fixed,auto_dismissed&per_page=100`,
  ])
  // gh api --paginate concatenates JSON arrays separated by newlines — parse each
  // top-level array and merge. Actually gh api --paginate emits a single
  // concatenated array when the endpoint returns arrays.
  let alerts: unknown[] = []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) alerts = parsed
    else throw new Error('expected array')
  } catch {
    // Fall back: gh may emit one array per page separated by newlines
    alerts = raw
      .split('\n')
      .filter((line) => line.trim().startsWith('['))
      .flatMap((line) => JSON.parse(line) as unknown[])
  }

  return alerts.map((a) => {
    const alert = a as Record<string, unknown>
    const rule = (alert.rule as Record<string, unknown> | undefined) ?? {}
    const instance = (alert.most_recent_instance as Record<string, unknown> | undefined) ?? {}
    const location = (instance.location as Record<string, unknown> | undefined) ?? {}
    return {
      number: alert.number as number,
      rule: (rule.id as string | undefined) ?? 'unknown',
      state: alert.state as string,
      file: (location.path as string | undefined) ?? '',
      line: (location.start_line as number | null | undefined) ?? null,
      created_at: alert.created_at as string,
      fixed_at: (alert.fixed_at as string | null | undefined) ?? null,
      severity: (rule.severity as string | undefined) ?? 'unknown',
    }
  })
}

function fetchLlgdCommits(): LlgdCommit[] {
  // All commits touching LESSONS-LEARNED or KNOWN-GOTCHAS (any author, any ref).
  // --follow tracks renames if we ever move the files; safe to include even
  // though they haven't been renamed.
  const log = sh([
    'git', 'log', '--all', '--format=%H|%ai|%s',
    '--', LESSONS_PATH, GOTCHAS_PATH,
  ])
  const commits: LlgdCommit[] = []
  for (const line of log.trim().split('\n')) {
    if (!line.trim()) continue
    const [sha, date, ...subjectParts] = line.split('|')
    const subject = subjectParts.join('|')
    // Pull the diff for this commit restricted to the two files. -U0 = minimal
    // context; we want the added lines, not surrounding unchanged context, to
    // maximize signal-to-noise on topic matching.
    let diff = ''
    try {
      diff = sh([
        'git', 'show', '--format=', '-U0', sha,
        '--', LESSONS_PATH, GOTCHAS_PATH,
      ])
    } catch {
      // commit may be unreachable from a worktree; skip
      continue
    }
    commits.push({ sha, date, subject, diff })
  }
  return commits
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function alertWindow(alert: CodeQLAlert): [Date, Date] {
  const created = new Date(alert.created_at)
  const start = new Date(created.getTime() - 3 * 24 * 60 * 60 * 1000)
  const endBase = alert.fixed_at
    ? new Date(alert.fixed_at).getTime() + 7 * 24 * 60 * 60 * 1000
    : created.getTime() + 30 * 24 * 60 * 60 * 1000
  return [start, new Date(endBase)]
}

function commitInWindow(commit: LlgdCommit, window: [Date, Date]): boolean {
  const d = new Date(commit.date).getTime()
  return d >= window[0].getTime() && d <= window[1].getTime()
}

function matchedKeywords(alert: CodeQLAlert, commit: LlgdCommit): string[] {
  const diff = commit.diff.toLowerCase()
  const hits: string[] = []

  // 1. Rule short name (always auto-searched, case-insensitive, literal match
  // within diff content — we don't require it to be in its own line since
  // rule ids frequently show up embedded in sentences).
  if (alert.rule && diff.includes(alert.rule.toLowerCase())) {
    hits.push(`rule:${alert.rule}`)
  }

  // 2. File path. Strip any leading `code/` since our llgd text tends to
  // write paths in project-root form without the prefix.
  if (alert.file) {
    const file = alert.file.toLowerCase()
    const trimmed = file.startsWith('code/') ? file.slice(5) : file
    if (diff.includes(trimmed) || diff.includes(file)) {
      hits.push(`file:${alert.file}`)
    }
  }

  // 3. Rule → keyword table.
  const keywords = RULE_KEYWORDS[alert.rule] ?? []
  for (const kw of keywords) {
    if (diff.includes(kw.toLowerCase())) {
      hits.push(`kw:${kw}`)
    }
  }

  return hits
}

function classify(alert: CodeQLAlert, commits: LlgdCommit[]): AlertMatch {
  const window = alertWindow(alert)
  const inWindow = commits.filter((c) => commitInWindow(c, window))

  const matched: AlertMatch['matchedCommits'] = []
  for (const commit of inWindow) {
    const hits = matchedKeywords(alert, commit)
    if (hits.length > 0) {
      matched.push({ sha: commit.sha, subject: commit.subject, matchedOn: hits })
    }
  }

  let classification: Classification
  if (matched.length > 0) classification = 'captured'
  else if (inWindow.length > 0) classification = 'ambiguous'
  else classification = 'missed'

  return {
    alert,
    classification,
    matchedCommits: matched,
    inWindowCommits: inWindow
      .filter((c) => !matched.find((m) => m.sha === c.sha))
      .map((c) => ({ sha: c.sha, subject: c.subject })),
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

interface Report {
  generatedAt: string
  sourceRepo: string
  totalAlerts: number
  realAlerts: number     // excluding Scorecard meta-findings
  metaAlerts: number     // Scorecard-only
  byStatus: Record<Classification, number>
  realByStatus: Record<Classification, number>
  byRule: Record<string, { alerts: number; captured: number; missed: number; ambiguous: number; isMeta: boolean }>
  byWindow: {
    '30d': Record<Classification, number>
    '90d': Record<Classification, number>
    'all-time': Record<Classification, number>
  }
  missedAlerts: Array<{ number: number; rule: string; file: string; created_at: string; state: string }>
  ambiguousAlerts: Array<{ number: number; rule: string; file: string; inWindowCommits: string[] }>
}

function buildReport(matches: AlertMatch[]): Report {
  const now = new Date()
  const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const cutoff90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const byStatus: Record<Classification, number> = { captured: 0, missed: 0, ambiguous: 0 }
  const realByStatus: Record<Classification, number> = { captured: 0, missed: 0, ambiguous: 0 }
  const byWindow: Report['byWindow'] = {
    '30d': { captured: 0, missed: 0, ambiguous: 0 },
    '90d': { captured: 0, missed: 0, ambiguous: 0 },
    'all-time': { captured: 0, missed: 0, ambiguous: 0 },
  }
  const byRule: Report['byRule'] = {}
  const missedAlerts: Report['missedAlerts'] = []
  const ambiguousAlerts: Report['ambiguousAlerts'] = []

  let meta = 0
  for (const m of matches) {
    byStatus[m.classification]++
    const isMeta = META_RULES.has(m.alert.rule)
    if (isMeta) meta++
    else realByStatus[m.classification]++

    byWindow['all-time'][m.classification]++
    const created = new Date(m.alert.created_at)
    if (created >= cutoff90d) byWindow['90d'][m.classification]++
    if (created >= cutoff30d) byWindow['30d'][m.classification]++

    const bucket = byRule[m.alert.rule] ?? { alerts: 0, captured: 0, missed: 0, ambiguous: 0, isMeta }
    bucket.alerts++
    bucket[m.classification]++
    byRule[m.alert.rule] = bucket

    if (m.classification === 'missed') {
      missedAlerts.push({
        number: m.alert.number,
        rule: m.alert.rule,
        file: m.alert.file,
        created_at: m.alert.created_at,
        state: m.alert.state,
      })
    } else if (m.classification === 'ambiguous') {
      ambiguousAlerts.push({
        number: m.alert.number,
        rule: m.alert.rule,
        file: m.alert.file,
        inWindowCommits: m.inWindowCommits.map((c) => `${c.sha.slice(0, 10)} ${c.subject}`),
      })
    }
  }

  return {
    generatedAt: now.toISOString(),
    sourceRepo: FREE_REPO,
    totalAlerts: matches.length,
    realAlerts: matches.length - meta,
    metaAlerts: meta,
    byStatus,
    realByStatus,
    byRule,
    byWindow,
    missedAlerts,
    ambiguousAlerts,
  }
}

function renderMarkdown(report: Report): string {
  const pct = (n: number, d: number) => (d === 0 ? 'N/A' : ((n / d) * 100).toFixed(1) + '%')
  const lines: string[] = []

  lines.push('# LLGD Coverage Baseline')
  lines.push('')
  lines.push(`**Generated:** ${report.generatedAt}`)
  lines.push(`**Source repo:** ${report.sourceRepo}`)
  lines.push('')
  lines.push('Measures: of historical CodeQL findings on Weaver-Free, how many produced an `llgd` entry in LESSONS-LEARNED.md or KNOWN-GOTCHAS.md? This is the "before" half of a before/after comparison that v1.0.4\'s Semgrep + Tier-1 coverage-gap detector will complete.')
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push('| | Total | Captured | Missed | Ambiguous | Capture rate |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |')
  lines.push(`| All alerts | ${report.totalAlerts} | ${report.byStatus.captured} | ${report.byStatus.missed} | ${report.byStatus.ambiguous} | ${pct(report.byStatus.captured, report.totalAlerts)} |`)
  lines.push(`| Real findings (non-meta) | ${report.realAlerts} | ${report.realByStatus.captured} | ${report.realByStatus.missed} | ${report.realByStatus.ambiguous} | ${pct(report.realByStatus.captured, report.realAlerts)} |`)
  lines.push(`| Scorecard meta-findings | ${report.metaAlerts} | ${report.byStatus.captured - report.realByStatus.captured} | ${report.byStatus.missed - report.realByStatus.missed} | ${report.byStatus.ambiguous - report.realByStatus.ambiguous} | — |`)
  lines.push('')
  lines.push('**Capture rate** is the headline metric. Ambiguous = commits in window but no topic match — needs human review to decide captured vs missed. Conservative reading: treat ambiguous as missed for the floor.')
  lines.push('')
  lines.push('## By time window')
  lines.push('')
  lines.push('| Window | Total | Captured | Missed | Ambiguous | Capture rate |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |')
  for (const w of ['30d', '90d', 'all-time'] as const) {
    const b = report.byWindow[w]
    const total = b.captured + b.missed + b.ambiguous
    lines.push(`| ${w} | ${total} | ${b.captured} | ${b.missed} | ${b.ambiguous} | ${pct(b.captured, total)} |`)
  }
  lines.push('')
  lines.push('## By rule')
  lines.push('')
  lines.push('Rules sorted by alert count descending. Meta rules (Scorecard aspirational grades) separated at bottom.')
  lines.push('')
  lines.push('| Rule | Alerts | Captured | Missed | Ambiguous | Notes |')
  lines.push('| --- | ---: | ---: | ---: | ---: | --- |')
  const ruleEntries = Object.entries(report.byRule)
    .sort((a, b) => {
      if (a[1].isMeta !== b[1].isMeta) return a[1].isMeta ? 1 : -1  // real rules first
      return b[1].alerts - a[1].alerts
    })
  for (const [rule, b] of ruleEntries) {
    const note = b.isMeta ? 'meta (Scorecard)' : ''
    lines.push(`| \`${rule}\` | ${b.alerts} | ${b.captured} | ${b.missed} | ${b.ambiguous} | ${note} |`)
  }
  lines.push('')
  if (report.missedAlerts.length > 0) {
    lines.push('## Missed alerts (no in-window llgd commits)')
    lines.push('')
    lines.push('Alerts where no `llgd` file was touched within the window. Candidates for v1.0.4 Tier-1 retroactive documentation or confirmation that the class was intentionally not llgd-worthy (trivial fix).')
    lines.push('')
    lines.push('| # | Rule | File | Created | State |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const a of report.missedAlerts.slice(0, 50)) {
      lines.push(`| ${a.number} | \`${a.rule}\` | \`${a.file || '—'}\` | ${a.created_at.slice(0, 10)} | ${a.state} |`)
    }
    if (report.missedAlerts.length > 50) {
      lines.push('')
      lines.push(`(${report.missedAlerts.length - 50} more in JSON output)`)
    }
    lines.push('')
  }
  if (report.ambiguousAlerts.length > 0) {
    lines.push('## Ambiguous alerts (in-window commits but no topic match)')
    lines.push('')
    lines.push('Alerts where an `llgd` commit landed in the window but did not match the rule name, file path, or keyword table. Most likely one of:')
    lines.push('- The llgd entry used different vocabulary than our keyword table expected (→ extend `RULE_KEYWORDS` in the script).')
    lines.push('- The llgd commit addressed a different topic (→ genuinely missed).')
    lines.push('')
    lines.push('| # | Rule | File | In-window commits |')
    lines.push('| --- | --- | --- | --- |')
    for (const a of report.ambiguousAlerts.slice(0, 30)) {
      const commits = a.inWindowCommits.slice(0, 3).join(' · ')
      const more = a.inWindowCommits.length > 3 ? ` (+${a.inWindowCommits.length - 3})` : ''
      lines.push(`| ${a.number} | \`${a.rule}\` | \`${a.file || '—'}\` | ${commits}${more} |`)
    }
    lines.push('')
  }
  lines.push('## Hand-off to v1.0.4')
  lines.push('')
  lines.push('The v1.0.4 Tier-1 coverage-gap detector (see [plans/v1.0.4/EXECUTION-ROADMAP.md](../../plans/v1.0.4/EXECUTION-ROADMAP.md)) produces the ongoing "after" data. The capture rate here is the historical floor to compare against.')
  lines.push('')
  lines.push('Success looks like:')
  lines.push('- Real-findings capture rate ≥ 80% after v1.0.4 rolls out (the llgd-over-CodeQL convention claims this is achievable).')
  lines.push('- Any rule with a `missed` count > 0 has a Semgrep rule authored in v1.0.4 or an explicit "intentionally not llgd-worthy" marker.')
  lines.push('- Ambiguous shrinks to near-zero as the keyword table matures.')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(`*Generated by \`scripts/audit-llgd-coverage-baseline.ts\`. Re-run with \`npx tsx scripts/audit-llgd-coverage-baseline.ts\`. Spec: [plans/v1.0.2/LLGD-BACKFILL-SPEC.md](../../plans/v1.0.2/LLGD-BACKFILL-SPEC.md).*`)
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

function main(): void {
  console.log('LLGD Coverage Baseline — one-shot')
  console.log(`  Source repo: ${FREE_REPO}`)

  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true })

  console.log('  Fetching CodeQL alert history...')
  const alerts = fetchCodeQLAlerts()
  console.log(`    ${alerts.length} alerts`)

  console.log('  Fetching llgd commit history...')
  const commits = fetchLlgdCommits()
  console.log(`    ${commits.length} commits touching LESSONS-LEARNED or KNOWN-GOTCHAS`)

  console.log('  Classifying alerts...')
  const matches = alerts.map((a) => classify(a, commits))

  const report = buildReport(matches)

  writeFileSync(JSON_OUT, JSON.stringify(report, null, 2) + '\n')
  writeFileSync(MD_OUT, renderMarkdown(report))

  console.log()
  console.log(`  Total alerts:     ${report.totalAlerts}`)
  console.log(`    real:           ${report.realAlerts}`)
  console.log(`    meta (Scorecard):${report.metaAlerts}`)
  console.log(`  By classification (all):`)
  console.log(`    captured:       ${report.byStatus.captured}`)
  console.log(`    missed:         ${report.byStatus.missed}`)
  console.log(`    ambiguous:      ${report.byStatus.ambiguous}`)
  if (report.realAlerts > 0) {
    const rate = (report.realByStatus.captured / report.realAlerts) * 100
    console.log(`  Real-findings capture rate: ${rate.toFixed(1)}%`)
  }
  console.log()
  console.log(`  Report written:`)
  console.log(`    JSON: ${JSON_OUT}`)
  console.log(`    MD:   ${MD_OUT}`)
}

main()
