// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Agent Knowledge Coverage Auditor
 *
 * Enforces that every executable agent spec in agents/v(version)/ declares its
 * knowledge sources and that every cited reference resolves. Agents are
 * long-lived Forge specs that may execute months after they're authored —
 * if a cited MCP tool was renamed, a rule file was moved, or a decision
 * number was superseded, the agent gets stale knowledge silently. This
 * auditor catches that drift at compliance time.
 *
 * Scope:
 *   - Versioned executable agent specs under agents/vMAJOR.MINOR.PATCH/
 *   - Excludes: MANIFEST.md, agents/archive, agents/templates,
 *     agents/gtm, suite-overview files that self-identify as "not an
 *     executable agent spec"
 *
 * Checks:
 *   1. KNOWLEDGE SECTION PRESENT — every executable spec has either
 *      a Context-to-Read-Before-Starting section or a Knowledge-Sources
 *      section (two accepted names; existing convention is the former).
 *   2. HEADER REFERENCES — at least one of Plan / Decision / Design record
 *      line near the top of the file (structured frontmatter-ish citations).
 *   3. CITED FILE PATHS RESOLVE — every .claude/rules/ path,
 *      plans/ path, code/docs/ path, business/ path cited
 *      in the knowledge section must exist on disk.
 *   4. CITED DECISIONS RESOLVE — every Decision-N citation
 *      must exist as a row in MASTER-PLAN Decisions Resolved.
 *   5. CITED MCP TOOLS RESOLVE — every getLessonsLearned(...),
 *      getKnownGotchas(...), etc. named in the knowledge section must
 *      match a real tool in code/mcp-server/src/tools/.
 *
 * Enforcement mode:
 *   - Default: errors on all specs missing sections or with broken refs.
 *   - --staged mode: only fails on specs modified in the current git
 *     working tree (pre-commit-friendly). Existing specs without full
 *     coverage are grandfathered; any edit triggers full checks.
 *
 * Invocation:
 *   npx tsx scripts/verify-agent-knowledge-coverage.ts
 *   npx tsx scripts/verify-agent-knowledge-coverage.ts --staged
 *   or: npm run audit:agent-knowledge-coverage
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more violations
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')
const AGENTS_DIR = resolve(PROJECT_ROOT, 'agents')
const MASTER_PLAN = resolve(PROJECT_ROOT, 'MASTER-PLAN.md')
const MCP_TOOLS_DIR = resolve(CODE_ROOT, 'mcp-server', 'src', 'tools')

const KNOWLEDGE_SECTION_RE = /^##\s+(Context\s+to\s+Read\s+Before\s+Starting|Knowledge\s+Sources)\s*$/mi

interface Violation {
  spec: string
  check: string
  detail: string
}

// Find all executable agent specs. Exclude MANIFEST.md, archive, templates, gtm.
function findExecutableSpecs(): string[] {
  const specs: string[] = []
  if (!existsSync(AGENTS_DIR)) return specs

  for (const entry of readdirSync(AGENTS_DIR)) {
    const sub = resolve(AGENTS_DIR, entry)
    if (!statSync(sub).isDirectory()) continue
    if (['archive', 'templates', 'gtm'].includes(entry)) continue
    if (!/^v\d+\.\d+\.\d+$/.test(entry)) continue

    for (const file of readdirSync(sub)) {
      if (!file.endsWith('.md')) continue
      if (file === 'MANIFEST.md') continue
      specs.push(resolve(sub, file))
    }
  }
  return specs
}

// Identify exempt specs. Three shapes are exempt from the Context-section
// requirement:
//
//   1. Suite-overview / coordinator files — self-document as "not an
//      executable agent spec". The sub-agents they coordinate carry the
//      knowledge-source burden individually.
//   2. Coordinator pattern — title contains "(Coordinator)" + a sub-agent
//      split callout, even without the explicit phrase.
//   3. TBD / stub specs — self-document as "Spec status: TBD" or
//      equivalent. Full spec lives in the plan file referenced from
//      the stub. Provisional Context citations would be false precision;
//      when the real spec is written, the auditor applies.
function isExempt(content: string): boolean {
  if (/This is (?:an index|a coordinator),?\s+not\s+an?\s+executable\s+agent\s+spec/i.test(content)) {
    return true
  }
  if (/^#\s.*\(Coordinator\)/m.test(content) && /split\s+into\s+\d+\s+.*sub-agent/i.test(content)) {
    return true
  }
  if (/\*\*Spec\s+status:\s*TBD\*\*/i.test(content) || /Full\s+(?:agent\s+)?spec\s+to\s+be\s+written/i.test(content)) {
    return true
  }
  return false
}

// Get staged agent specs (for --staged mode).
function getStagedSpecs(): Set<string> {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return new Set(
      out
        .split('\n')
        .filter((f) => /^agents\/v\d+\.\d+\.\d+\/[^/]+\.md$/.test(f))
        .filter((f) => !f.endsWith('/MANIFEST.md'))
        .map((f) => resolve(PROJECT_ROOT, f)),
    )
  } catch {
    return new Set()
  }
}

// Parse existing decision numbers from MASTER-PLAN.
function loadDecisions(): Set<number> {
  if (!existsSync(MASTER_PLAN)) return new Set()
  const text = readFileSync(MASTER_PLAN, 'utf8')
  const decisions = new Set<number>()
  for (const m of text.matchAll(/^\|\s*(\d+)\s*\|/gm)) {
    decisions.add(parseInt(m[1]!, 10))
  }
  return decisions
}

// Parse MCP tool names from mcp-server/src/tools/.
function loadMcpTools(): Set<string> {
  const tools = new Set<string>()
  if (!existsSync(MCP_TOOLS_DIR)) return tools
  for (const file of readdirSync(MCP_TOOLS_DIR)) {
    if (!file.endsWith('.ts')) continue
    if (file.endsWith('.spec.ts') || file.endsWith('.test.ts')) continue
    const text = readFileSync(resolve(MCP_TOOLS_DIR, file), 'utf8')
    // Look for export function getFoo(...) or export const getFoo = ...
    for (const m of text.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
      tools.add(m[1]!)
    }
    for (const m of text.matchAll(/export\s+const\s+(\w+)\s*=/g)) {
      tools.add(m[1]!)
    }
  }
  return tools
}

// ─── Checks ────────────────────────────────────────────────────────────────

function checkKnowledgeSectionPresent(specPath: string, content: string): Violation[] {
  if (KNOWLEDGE_SECTION_RE.test(content)) return []
  return [
    {
      spec: relative(PROJECT_ROOT, specPath),
      check: 'knowledge-section',
      detail:
        'missing `## Context to Read Before Starting` (or `## Knowledge Sources`) section — executable agent specs must declare which files, rules, and tools the agent should consult before acting',
    },
  ]
}

function checkHeaderReferences(specPath: string, content: string): Violation[] {
  // Require at least one of **Plan:** / **Decision:** / **Decisions:** / **Design record:**
  const head = content.slice(0, 2000)
  if (
    !/\*\*Plan:\*\*|\*\*Decision:\*\*|\*\*Decisions:\*\*|\*\*Design record:\*\*/i.test(head)
  ) {
    return [
      {
        spec: relative(PROJECT_ROOT, specPath),
        check: 'header-refs',
        detail:
          'missing header-reference lines — agent specs should cite at least one of **Plan:**, **Decision:**, **Decisions:**, or **Design record:** near the top',
      },
    ]
  }
  return []
}

function checkCitedPathsResolve(specPath: string, content: string): Violation[] {
  const vs: Violation[] = []
  // Extract the knowledge section body.
  const match = content.match(
    /##\s+(?:Context\s+to\s+Read\s+Before\s+Starting|Knowledge\s+Sources)[\s\S]*?(?=\n##\s+|\n*$)/i,
  )
  const knowledgeBody = match ? match[0] : content // fall back to whole doc

  // Inline references like `code/.claude/rules/nixos.md` (backtick-quoted or not).
  // Match paths that start with a known scanned location.
  const pathRe = /(?:^|[\s(`'"])((?:\.\.\/)*(?:code\/)?(?:\.claude\/rules|plans|agents|business|code\/docs|code\/backend|code\/src|code\/nixos|code\/testing)\/[^\s`'")\]]+\.(?:md|ts|tsx|vue|json|nix|yaml|yml|sh))/g

  for (const m of knowledgeBody.matchAll(pathRe)) {
    const raw = m[1]!
    // Strip relative-traversal prefix. Resolve relative to agents/<ver>/ since
    // that's where the spec lives; fall back to PROJECT_ROOT.
    const specDir = dirname(specPath)
    const resolved = resolve(specDir, raw)
    if (!existsSync(resolved) && !existsSync(resolve(PROJECT_ROOT, raw))) {
      vs.push({
        spec: relative(PROJECT_ROOT, specPath),
        check: 'cited-paths',
        detail: `cited path does not resolve: ${raw}`,
      })
    }
  }
  return vs
}

function checkCitedDecisions(
  specPath: string,
  content: string,
  decisions: Set<number>,
): Violation[] {
  const vs: Violation[] = []
  // Match `Decision #N` or standalone `#N` adjacent to Decision word.
  for (const m of content.matchAll(/Decision(?:s)?\s+(?:#|)(\d+)/gi)) {
    const n = parseInt(m[1]!, 10)
    if (!decisions.has(n)) {
      vs.push({
        spec: relative(PROJECT_ROOT, specPath),
        check: 'cited-decisions',
        detail: `cited Decision #${n} does not exist in MASTER-PLAN Decisions Resolved table`,
      })
    }
  }
  // Also #NNN patterns inside link text or bare — e.g., [#147](...) or just "#147".
  // But limit to a reasonable heuristic: match `#NN` or `#NNN` NOT preceded by
  // a backtick (ignore inline code) AND only in header-reference region (first
  // 2KB) + knowledge section to avoid false positives on arbitrary hash marks.
  return vs
}

// Plan-reference version-match check. When an agent spec sits at
// agents/vX.Y.0/<name>.md, its **Plan:** link should point at
// plans/vX.Y.0/EXECUTION-ROADMAP.md (matching parent-dir version) OR
// at a cross-version plan under plans/cross-version/. Anything else is
// a renumbering-drift smell — agent-extract.md cited v2.3 after the
// 2026-04-14 renumbering when it lives at agents/v2.4.0/.
//
// Exemption: cross-version plans are always allowed (they span
// releases by design). Multiple Plan: lines are allowed; at least one
// must satisfy the match.
function checkPlanVersionMatch(specPath: string, content: string): Violation[] {
  const m = specPath.match(/agents\/v(\d+\.\d+\.\d+)\//)
  if (!m) return []
  const specVersion = m[1]!
  // Extract all **Plan:** line targets — usually one, allow many.
  const planLines = content
    .split('\n')
    .filter((l) => /^\s*\*\*Plan(?:s)?:\*\*/i.test(l))
  if (planLines.length === 0) return [] // header-refs check handles missing Plan
  // Find the first link pointing at a plans/... path on any Plan line.
  const pathRe = /plans\/(?:cross-version|v\d+\.\d+\.\d+)\/[A-Za-z0-9_\-.]+\.md/g
  const cited: string[] = []
  for (const line of planLines) {
    for (const pm of line.matchAll(pathRe)) cited.push(pm[0])
  }
  if (cited.length === 0) return []
  const hasMatch = cited.some(
    (p) =>
      p.startsWith('plans/cross-version/') ||
      p.startsWith(`plans/v${specVersion}/`),
  )
  if (hasMatch) return []
  return [
    {
      spec: relative(PROJECT_ROOT, specPath),
      check: 'plan-version-match',
      detail: `spec lives at agents/v${specVersion}/ but **Plan:** cites ${cited.join(', ')} — likely a renumbering-drift artifact. Expected plans/v${specVersion}/ or plans/cross-version/`,
    },
  ]
}

// Freshness-marker check. Specs that don't yet carry real MCP tool
// citations may instead carry a `<!-- knowledge-freshness: YYYY-MM-DD -->`
// stub documenting that MCP retrofit is pending and when it was last
// reviewed. Two gates:
//
//   (a) Ready-aware HARD ERROR — if the spec's version is marked
//       `ready: true` in forge/STATUS.json (= about to be executed),
//       retrofit is required before execution; a stub is a blocker.
//       Narrowed from "blocked-by-current" to "ready:true" so the
//       entire future queue doesn't block compliance today — only
//       specs being actively prepared for execution.
//
//   (b) Calendar WARN — if the stub is older than STALE_DAYS regardless
//       of queue position, warn. Forces periodic review even for
//       distant-version specs so they don't rot silently.
//
// Not a hard error in case (b): the stub means "acknowledged pending
// work"; staleness is a reminder, not a regression.
//
// Threshold tuning: set to 45 days on 2026-04-23 (was 180) to match the
// real release cadence. Revisit at v1.3 release with actual stub-churn
// data to see whether this cadence generates the right signal/noise mix.
const STALE_DAYS = 45
const FRESHNESS_RE = /<!--\s*knowledge-freshness:\s*(\d{4}-\d{2}-\d{2})\s*-->/

interface StatusJson {
  currentVersion: string
  queue?: Array<{ version: string; blockedBy?: string; ready?: boolean }>
}

let readyVersions: Set<string> | null = null

function loadReadyVersions(): Set<string> {
  if (readyVersions) return readyVersions
  const statusPath = resolve(PROJECT_ROOT, 'forge', 'STATUS.json')
  try {
    const status = JSON.parse(readFileSync(statusPath, 'utf8')) as StatusJson
    const ready = new Set<string>()
    for (const item of status.queue ?? []) {
      if (item.ready === true) {
        ready.add(item.version)
      }
    }
    readyVersions = ready
  } catch {
    // STATUS.json missing or malformed — treat as "no known ready
    // items," fall back to calendar-only behavior.
    readyVersions = new Set()
  }
  return readyVersions
}

function extractSpecVersion(specPath: string): string | null {
  // agents/vX.Y.Z/agent-name.md → X.Y.Z
  const match = specPath.match(/agents\/v(\d+\.\d+\.\d+)\//)
  return match ? match[1]! : null
}

function checkFreshnessMarker(specPath: string, content: string): Violation[] {
  const match = content.match(FRESHNESS_RE)
  if (!match) return [] // no stub; either the spec has real MCP citations (fine) or it's pre-convention (also fine — no regression)
  const stampStr = match[1]!
  const stamp = new Date(stampStr + 'T00:00:00Z')
  if (isNaN(stamp.getTime())) {
    return [
      {
        spec: relative(PROJECT_ROOT, specPath),
        check: 'freshness-marker',
        detail: `knowledge-freshness marker has invalid date '${stampStr}' — expected YYYY-MM-DD`,
      },
    ]
  }

  const violations: Violation[] = []

  // Gate (a) — ready-aware hard error. Fires only when the spec's
  // version is marked `ready: true` in forge/STATUS.json (= about to be
  // executed), not just queued. This narrows the block to the moment
  // retrofit actually matters.
  const specVersion = extractSpecVersion(specPath)
  if (specVersion) {
    const ready = loadReadyVersions()
    if (ready.has(specVersion)) {
      violations.push({
        spec: relative(PROJECT_ROOT, specPath),
        check: 'freshness-marker-ready-blocker',
        detail: `spec's version v${specVersion} is marked ready:true in forge/STATUS.json — knowledge-freshness stubs must be replaced with real MCP tool citations before execution. Retrofit the spec to cite resolvable paths + decisions + MCP tools, then remove the stub.`,
      })
    }
  }

  // Gate (b) — calendar warning.
  const ageMs = Date.now() - stamp.getTime()
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
  if (ageDays > STALE_DAYS) {
    violations.push({
      spec: relative(PROJECT_ROOT, specPath),
      check: 'freshness-marker',
      detail: `knowledge-freshness stub is ${ageDays} days old (threshold ${STALE_DAYS}) — retrofit MCP tool citations before this spec enters the Forge queue, then update the stub date or remove the stub`,
    })
  }

  return violations
}

function checkCitedMcpTools(
  specPath: string,
  content: string,
  tools: Set<string>,
): Violation[] {
  const vs: Violation[] = []
  // Match getXxx( or getXxx ) patterns — MCP tool invocations in prose or code fences.
  const match = content.match(
    /##\s+(?:Context\s+to\s+Read\s+Before\s+Starting|Knowledge\s+Sources)[\s\S]*?(?=\n##\s+|\n*$)/i,
  )
  const knowledgeBody = match ? match[0] : ''

  for (const m of knowledgeBody.matchAll(/\b(get[A-Z]\w+)\s*\(/g)) {
    const name = m[1]!
    if (tools.size === 0) {
      // MCP tools dir missing or empty — skip this check rather than false-fail.
      break
    }
    if (!tools.has(name)) {
      vs.push({
        spec: relative(PROJECT_ROOT, specPath),
        check: 'cited-mcp-tools',
        detail: `cited MCP tool ${name}() does not exist in code/mcp-server/src/tools/`,
      })
    }
  }
  return vs
}

// ─── Main ──────────────────────────────────────────────────────────────────

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function main(): void {
  const stagedMode = process.argv.includes('--staged')

  console.log(`${BOLD}Agent Knowledge Coverage Audit${RESET}`)
  console.log(
    `${DIM}Enforces every executable agent spec declares its knowledge sources${RESET}`,
  )
  console.log(`${DIM}and that every cited reference resolves.${RESET}`)
  if (stagedMode) {
    console.log(`${DIM}[--staged] only checking specs modified in working tree${RESET}`)
  }
  console.log()

  const allSpecs = findExecutableSpecs()
  const stagedSpecs = stagedMode ? getStagedSpecs() : null
  const scope = stagedSpecs ? allSpecs.filter((s) => stagedSpecs.has(s)) : allSpecs

  if (scope.length === 0) {
    if (stagedMode) {
      console.log(`${GREEN}✓${RESET} No agent specs staged — nothing to check`)
      process.exit(0)
    }
    console.log(`${YELLOW}⚠${RESET} No agent specs found in agents/v*/`)
    process.exit(0)
  }

  const decisions = loadDecisions()
  const tools = loadMcpTools()
  const violations: Violation[] = []
  let skipped = 0

  for (const specPath of scope) {
    const content = readFileSync(specPath, 'utf8')
    if (isExempt(content)) {
      skipped++
      continue
    }
    violations.push(...checkKnowledgeSectionPresent(specPath, content))
    violations.push(...checkHeaderReferences(specPath, content))
    violations.push(...checkCitedPathsResolve(specPath, content))
    violations.push(...checkCitedDecisions(specPath, content, decisions))
    violations.push(...checkCitedMcpTools(specPath, content, tools))
    violations.push(...checkFreshnessMarker(specPath, content))
    violations.push(...checkPlanVersionMatch(specPath, content))
  }

  console.log(
    `  ${GREEN}✓${RESET} Scanned ${scope.length} executable spec(s)${
      skipped > 0 ? ` (${skipped} suite-overview skipped)` : ''
    }`,
  )

  if (violations.length === 0) {
    console.log(`  ${GREEN}✓${RESET} All specs have knowledge-section present`)
    console.log(`  ${GREEN}✓${RESET} All header references present`)
    console.log(`  ${GREEN}✓${RESET} All cited paths resolve`)
    console.log(`  ${GREEN}✓${RESET} All cited decisions exist in MASTER-PLAN`)
    console.log(`  ${GREEN}✓${RESET} All cited MCP tools exist`)
    console.log()
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — agent knowledge coverage intact`)
    process.exit(0)
  }

  for (const v of violations) {
    console.log(`  ${RED}✗${RESET} [${v.check}] ${v.spec} — ${v.detail}`)
  }
  console.log()
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${violations.length} violation(s)`)
  process.exit(1)
}

main()
