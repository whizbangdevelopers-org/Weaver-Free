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
import { readFileSync, statSync } from 'fs'
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
}

main()
