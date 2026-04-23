// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Sync Markers — CLI + registry
 *
 * Registers every cross-cutting count/list whose canonical value lives
 * somewhere structured (package.json, run-compliance.ts, JSON files,
 * filesystem globs) and which is quoted verbatim across multiple prose
 * docs. Running this script rewrites the text between markers so docs
 * stay fresh without manual grep-and-bump.
 *
 * Pattern match: sync-deck.mjs, generate-numeric-claims.ts,
 * generate-versions.sh. Same mental model: structured source →
 * generated projection in docs.
 *
 * Invocations:
 *   npm run sync:markers           # apply — rewrite stale markers
 *   npm run sync:markers -- --check # diff only, exit 1 on drift (used by audit:marker-sync)
 *
 * Adding a new sync:
 *   1. Write a source function that returns a string or {name: string}.
 *   2. Call registerMarker({ name, source, docs, description }).
 *   3. Insert <!-- name:begin --><!-- name:end --> markers in each doc.
 *   4. Run npm run sync:markers once to populate.
 *   5. audit:marker-sync now guards it; pre-commit hook re-syncs on source change.
 */

import { registerMarker, applyAll, checkAll, getRegistry, PROJECT_ROOT } from './lib/marker-sync.ts'
import { PHASES } from './run-compliance.ts'
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

// ---- Registrations --------------------------------------------------

// Auditor count + ordered list. Source: run-compliance.ts PHASES.
// Flatten all phases, strip the build:tui prerequisite and the audit:
// prefix, keep phase-order as the canonical rendering.
registerMarker({
  name: 'auditor-count',
  description: 'Number of static auditors in test:compliance chain',
  source: () => {
    const all = PHASES.flatMap((p) => p.entries)
      .filter((e) => e !== 'build:tui')
      .map((e) => (e.startsWith('audit:') ? e.slice('audit:'.length) : e))
    return String(all.length)
  },
  docs: [
    'code/CLAUDE.md',
    'STATUS.md',
    'MASTER-PLAN.md',
    'NOTES.md',
    'code/docs/security/ENGINEERING-DISCIPLINE.md',
    'code/docs/OPEN-SOURCE-INVENTORY.md',
    'code/docs/workflows/GAP-ANALYSIS.md',
  ],
})

// Vertical count. Source: `.md` files at top level of
// business/sales/verticals/ (deferred/ subdir excluded automatically).
// Drift has already happened here — docs cite "13 verticals" but the
// filesystem has diverged. Marker-sync surfaces the drift; Mark reviews
// the resulting diff and decides whether to update prose or tune the
// source (e.g., if some verticals should be moved to deferred/).
registerMarker({
  name: 'vertical-count',
  description: 'Shipped vertical sales documents (top-level verticals/*.md)',
  source: () => {
    const dir = resolve(PROJECT_ROOT, 'business', 'sales', 'verticals')
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
    return String(files.length)
  },
  docs: [
    'code/docs/security/ENGINEERING-DISCIPLINE.md',
    'business/sales/VERTICAL-STATUS.md',
    'business/investor/PITCH-DECK-READINESS.md',
    'business/marketing/website-drafts/weaver-compliance.md',
  ],
})

// Decision count. Source: table rows in MASTER-PLAN.md Decisions
// Resolved section, matching `| <digits> | ...`. verify-decision-parity
// does the same parse for its own check; this source mirrors that logic.
registerMarker({
  name: 'decision-count',
  description: 'Number of Decisions Resolved in MASTER-PLAN.md',
  source: () => {
    const plan = readFileSync(resolve(PROJECT_ROOT, 'MASTER-PLAN.md'), 'utf8')
    const afterHeader = plan.split('## Decisions Resolved')[1] ?? ''
    const untilNext = afterHeader.split(/\n## [A-Z]/)[0] ?? ''
    const rows = untilNext.match(/^\| \d+ \|/gm) ?? []
    return String(rows.length)
  },
  docs: [
    'NOTES.md',
  ],
})

// MCP tool count. Source: `.ts` files in code/mcp-server/src/tools/
// (each file registers one tool). Does not exclude any — tool count
// equals file count by convention.
registerMarker({
  name: 'mcp-tool-count',
  description: 'Number of MCP tools in the Weaver MCP server',
  source: () => {
    const dir = resolve(PROJECT_ROOT, 'code', 'mcp-server', 'src', 'tools')
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'))
    return String(files.length)
  },
  docs: [
    'NOTES.md',
  ],
})

registerMarker({
  name: 'auditor-list',
  description: 'Comma-separated list of static auditors in phase order',
  source: () => {
    const all = PHASES.flatMap((p) => p.entries)
      .filter((e) => e !== 'build:tui')
      .map((e) => (e.startsWith('audit:') ? e.slice('audit:'.length) : e))
    return all.join(', ')
  },
  docs: [
    // auditor-list is the comma-separated name enumeration; only docs
    // that carry the full list get this marker.
    'code/CLAUDE.md',
    'STATUS.md',
    'MASTER-PLAN.md',
  ],
})

// ---- CLI ------------------------------------------------------------

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function main(): void {
  const check = process.argv.includes('--check')

  if (check) {
    const violations = checkAll()
    if (violations.length === 0) {
      console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — ${getRegistry().length} marker source(s) in sync across docs`)
      process.exit(0)
    }
    console.log(`${BOLD}Marker Sync — Check Mode${RESET}`)
    console.log(`${DIM}Verifies every registered marker matches its canonical source.${RESET}`)
    console.log()
    for (const v of violations) {
      console.log(`  ${RED}✗${RESET} [${v.doc}] ${v.detail}`)
    }
    console.log()
    console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${violations.length} marker drift(s)`)
    process.exit(1)
  }

  const modified = applyAll()
  if (modified.length === 0) {
    console.log('No markers needed updating.')
  } else {
    console.log(`Updated ${modified.length} doc(s):`)
    for (const m of modified) console.log(`  - ${m}`)
  }
}

main()
