/**
 * audit-template-divergence.ts — shared portfolio files must not fork.
 *
 * WHY
 *
 * quasar-project-template and every project descended from it (Weaver, Gantry, Qepton) carry
 * copies of shared infrastructure. Those copies can diverge, and the portfolio has already been
 * bitten: the template and Weaver forked on scripts/audit-sast.ts — the template was fixed,
 * Weaver kept the broken copy, and both were true for an unknown length of time. The only sync
 * tooling was a sonnet agent invoked manually before releases, whose content check read "the
 * first 20 lines and flag if substantially different". A fork deep in a rules array is invisible
 * to that.
 *
 * This is the deterministic backstop. It runs in the compliance chain, every push, no judgment
 * and no memory required: for each file declared in scripts/shared-with-template.txt, the
 * project's copy must byte-match the template's. A mismatch WARNS.
 *
 * WARN, NOT FAIL — on purpose, same discipline as audit:core-drift's staleness check. Divergence
 * can be caused by either side (the template advanced, OR this project has a fix worth promoting
 * upstream), so which direction is authoritative is a human call. A hard fail would break a
 * project's CI every time the template moved. The warning makes the fork loud; a human reconciles
 * it (promote up, or re-sync down).
 *
 * DEGRADES TO SILENCE when it cannot run — the template repo is not on this machine (CI, a fresh
 * clone), git/fs unavailable. A divergence signal that broke CI in those cases would be worse
 * than no signal.
 *
 * A BROKEN MANIFEST IS A FAILURE, not a warning: if a declared path is missing from the TEMPLATE,
 * the list itself is wrong and must be fixed. That is the one thing this auditor is strict about,
 * because a manifest that points at nothing is a checker that checks nothing.
 */

import { createHash } from 'crypto'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..')
const MANIFEST = join(SCRIPT_DIR, 'shared-with-template.txt')

function sha256(path: string): string | null {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex')
  } catch {
    return null
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function findTemplateRoot(): string | null {
  const candidates = [
    process.env.TEMPLATE_ROOT,
    join(process.env.HOME ?? '', 'Projects', 'active', 'quasar-project-template'),
  ].filter((p): p is string => Boolean(p))
  return candidates.find(p => isDir(join(p, '.git'))) ?? null
}

// ---------------------------------------------------------------------------
// Reach — is anything portfolio-wide MISSING from the template entirely?
//
// The manifest check answers "do the DECLARED shared files still match?". It cannot answer
// "should this file have been declared in the first place?" — and that is the gap both of this
// portfolio's real incidents fell through:
//
//   - two Weaver knowledge entries sat unprojected into the archetype for 17 days;
//   - three core rules were weaver-ahead and surfaced only via a hand-written carry-in.
//
// Neither was on the manifest, so neither was ever compared. A file nobody declared is a file
// nobody checks, and "never declared" is indistinguishable from "in sync" when the only control
// is a declared-list diff.
//
// `.claude/rules/core/` is the population with a machine-checkable claim attached: core/ MEANS
// stack-agnostic — that is the entire premise of the core/stack split, which exists because
// universal invariants hidden behind a TypeScript glob never loaded in a PHP repo. A core rule
// that exists in only one repo contradicts its own directory.
//
// PRESENCE, not equality. Weaver's core/security.md legitimately names sops-nix and Decision
// WVR-73; the template's cannot. Demanding byte-equality here would force either a permanent
// false fork-warning or the deletion of project-specific detail. Presence is the assertion that
// actually holds for this population — equality is what the manifest above is for.
// ---------------------------------------------------------------------------

/**
 * core/ rules that are legitimately project-specific despite living in core/.
 * Each carries a reason — a bare exemption is gaming (never-game-auditors.md).
 */
const REACH_EXEMPT: Record<string, string> = {
  'terminology.md':
    'Product vocabulary by definition — tier names, Rethread, Ply, Jacquard, license-key ' +
    'prefixes. It lives in core/ because it must ALWAYS load, not because it is portfolio-wide. ' +
    'The template carries its own.',
}

/** Entry ids declared `scope: universal` in a project's knowledge store. */
function universalEntryIds(root: string): Set<string> {
  const out = new Set<string>()
  const base = join(root, 'code', 'docs', 'knowledge')
  for (const cat of ['lessons', 'gotchas']) {
    const dir = join(base, cat)
    let files: string[]
    try {
      files = readdirSync(dir).filter(f => f.endsWith('.md'))
    } catch {
      continue
    }
    for (const f of files) {
      let text: string
      try {
        text = readFileSync(join(dir, f), 'utf-8')
      } catch {
        continue
      }
      const re = /<!--\s*entry:([A-Za-z0-9-]+)\s*-->([\s\S]*?)(?=<!--\s*entry:|$)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        if (/^scope:\s*universal\s*$/m.test(m[2]!)) out.add(m[1]!)
      }
    }
  }
  return out
}

/**
 * A `scope: universal` entry is, by its own declaration, true for any project on any stack — that
 * is what the rung MEANS, and it is why the projection copies it into every scaffolding template.
 * So an entry marked universal that never arrives upstream is contradicting its own scope, in
 * exactly the way a core/ rule that exists in one repo contradicts its directory.
 *
 * This is the half the earlier reach check did not cover, and it is where the 17-day incident
 * actually happened: two entries were unroutable, reached no consumer, and nothing noticed —
 * because the only thing watching was a human writing a carry-in note.
 */
function checkKnowledgeReach(templateRoot: string): void {
  const mine = universalEntryIds(REPO_ROOT)
  if (mine.size === 0) {
    console.log('  Reach (knowledge) — no scope:universal entries here; skipped.\n')
    return
  }

  const theirs = universalEntryIds(templateRoot)
  if (theirs.size === 0) {
    console.warn(
      '  ⚠ the template has NO scope:universal entries — either its store moved, or this check\n' +
        '    is reading the wrong path and has gone blind. Verify before trusting a later PASS.\n',
    )
    return
  }

  const missing = [...mine].filter(id => !theirs.has(id)).sort()
  if (missing.length === 0) {
    console.log(`  ✓ reach (knowledge) — all ${mine.size} scope:universal entr(ies) reach the template.\n`)
    return
  }

  for (const id of missing.slice(0, 12)) {
    console.warn(`  ⚠ UNIVERSAL but NOT IN TEMPLATE: ${id}`)
  }
  if (missing.length > 12) console.warn(`  ⚠ …and ${missing.length - 12} more`)
  console.warn(
    '\n    These declare themselves true for any project on any stack, but never arrived upstream.\n' +
      '    Re-run the knowledge projection, or correct the scope if they are not actually universal.\n' +
      '    Warning only — which of the two it is, is a human call.\n',
  )
}

function checkReach(templateRoot: string): void {
  const coreDir = join(REPO_ROOT, '.claude', 'rules', 'core')
  if (!isDir(coreDir)) {
    console.log('  Reach — no .claude/rules/core/ here; skipped (split not adopted).\n')
    return
  }

  let mine: string[]
  try {
    mine = readdirSync(coreDir).filter(f => f.endsWith('.md')).sort()
  } catch {
    return
  }

  // Saturation guard: an empty population would report clean forever.
  if (mine.length === 0) {
    console.error('  ✗ .claude/rules/core/ exists but holds no rules — this check has gone blind.\n')
    process.exit(1)
  }

  const exempt = mine.filter(f => REACH_EXEMPT[f])
  const missing = mine.filter(
    f => !REACH_EXEMPT[f] && sha256(join(templateRoot, '.claude', 'rules', 'core', f)) === null,
  )

  if (missing.length === 0) {
    const n = mine.length - exempt.length
    const suffix = exempt.length > 0 ? ` (${exempt.length} exempt)` : ''
    console.log(`  ✓ reach — all ${n} portfolio-wide core rule(s) reach the template${suffix}.\n`)
    return
  }

  for (const f of missing) {
    console.warn(`  ⚠ NOT IN TEMPLATE (core/ means stack-agnostic): .claude/rules/core/${f}`)
  }
  console.warn(
    '\n    A core/ rule is stack-agnostic by definition, so one that exists only here is either\n' +
      '      • owed upstream — extract it, editing for generality on the way up; or\n' +
      '      • not actually portfolio-wide — move it out of core/, or add it to REACH_EXEMPT\n' +
      '        with a reason.\n' +
      '    Warning only — which of the two it is, is a human call.\n',
  )
}

function main(): void {
  const paths = readFileSync(MANIFEST, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))

  if (paths.length === 0) {
    console.error('\n  ✗ shared-with-template.txt declares no files — refusing to pass vacuously.\n')
    process.exit(1)
  }

  const templateRoot = findTemplateRoot()
  if (!templateRoot) {
    console.log('\n  Template divergence — template repo not on this machine; skipped.')
    console.log('  (Set TEMPLATE_ROOT to enable. Not an error — this is expected in CI.)\n')
    return
  }

  // Running inside the template itself: it is the source of truth and cannot fork from itself.
  // Just validate that every declared path actually exists here — a broken manifest is a bug.
  const isTemplate = resolve(templateRoot) === REPO_ROOT
  if (isTemplate) {
    const absent = paths.filter(p => sha256(join(REPO_ROOT, p)) === null)
    if (absent.length > 0) {
      console.error('\n  ✗ shared-with-template.txt lists files that do not exist in the template:')
      for (const p of absent) console.error(`      ${p}`)
      console.error('    Fix the manifest — a declared path that points at nothing checks nothing.\n')
      process.exit(1)
    }
    console.log(`\n  Template divergence — source of truth; ${paths.length} shared file(s) present.\n`)
    return
  }

  const forked: string[] = []
  const missingHere: string[] = []
  const missingUpstream: string[] = []

  for (const rel of paths) {
    const mine = sha256(join(REPO_ROOT, rel))
    const theirs = sha256(join(templateRoot, rel))

    if (theirs === null) {
      missingUpstream.push(rel) // manifest is stale / path renamed upstream
      continue
    }
    if (mine === null) {
      missingHere.push(rel)
      continue
    }
    if (mine !== theirs) forked.push(rel)
  }

  console.log(
    `\n  Template divergence — ${paths.length} shared file(s) vs ${templateRoot.replace(process.env.HOME ?? '~', '~')}\n`,
  )

  // A path missing UPSTREAM means the declared list no longer matches the template — the list is
  // wrong, and that is a hard failure (the one thing this auditor is strict about).
  if (missingUpstream.length > 0) {
    console.error('  ✗ declared shared files are missing from the TEMPLATE — the manifest is stale:')
    for (const p of missingUpstream) console.error(`      ${p}`)
    console.error('    Fix scripts/shared-with-template.txt (here and upstream) to match reality.\n')
    process.exit(1)
  }

  if (forked.length === 0 && missingHere.length === 0) {
    console.log('  ✓ every shared file matches the template. No forks.\n')
    checkReach(templateRoot)
  checkKnowledgeReach(templateRoot)
    return
  }

  // Divergence is a WARNING — loud, listed, non-fatal.
  for (const p of missingHere) console.warn(`  ⚠ MISSING here (present upstream): ${p}`)
  for (const p of forked) console.warn(`  ⚠ FORKED from template:              ${p}`)
  console.warn(
    '\n    These files are meant to be identical portfolio-wide. One side has changed. Reconcile:\n' +
      '      • the template moved  → re-sync the file down into this project;\n' +
      '      • this project has a fix → promote it up into the template, then re-sync everyone.\n' +
      '    Warning only — not a failure. Divergence direction is a human call.\n',
  )
  checkReach(templateRoot)
  checkKnowledgeReach(templateRoot)
}

main()
