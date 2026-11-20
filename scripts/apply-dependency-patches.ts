// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * apply-dependency-patches — a defect in a dependency is fixed in the dependency, by a patch kept in
 * `patches/` and applied at every install until the dependency releases the fix.
 *
 * No decision id here, unlike its gate: this file runs at every install, so it ships wherever the
 * code does, a public mirror included, and an id there points a reader at a register they cannot
 * read. Its gate, `scripts/verify-dependency-patches.ts`, cites the decision, and a repo that
 * publishes keeps the gate out of its mirror.
 *
 *   npx tsx scripts/apply-dependency-patches.ts           apply every patch in patches/
 *   npx tsx scripts/apply-dependency-patches.ts --check   apply nothing; fail unless every patch is in place
 *
 * A patch is a JSON file in `patches/`: the package, why, the test that shows the defect, and its
 * edits, each an exact text in one of the package's files and what replaces it. Every install runs
 * this: `npm ci` and `npm install` through the root's own `postinstall`, which npm runs under
 * strict-allow-scripts (measured, npm 11.19); each install made with `--ignore-scripts` (the E2E
 * images) by a step of its own; and the Nix build by a step of its own too, since whether its
 * `npm rebuild` runs the root's postinstall depends on its npm. `audit:dependency-patches` holds every
 * one of them to it. A second run finds every patch in place and writes nothing.
 *
 * Exact text, not a diff: `patch` applies a hunk at an offset and with fuzz, so a release that moved
 * the code could take a patch silently into the wrong place. Here an edit applies only where its text
 * appears exactly once, the replacement already present is "applied", and anything else is refused by
 * name, which is also how a release that changed the patched code is noticed: read the change, and
 * retire the patch once its test passes without it.
 *
 * A file is written to a temporary name and renamed over the original, never rewritten in place: the
 * pre-push worktree's node_modules is hard links into the checkout's, and an in-place write would
 * change both.
 */

import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface PatchEdit {
  /** the file, relative to the package's root */
  file: string
  /** the exact text replaced; it must appear once */
  find: string
  replace: string
}

export interface DependencyPatch {
  id: string
  package: string
  /** why the dependency is patched, citing its decision */
  why: string
  /** the test that fails without the patch, relative to the code root */
  test: string
  edits: PatchEdit[]
}

export interface PatchReport {
  applied: string[]
  alreadyApplied: string[]
  problems: string[]
}

function occurrences(text: string, part: string): number {
  return text.split(part).length - 1
}

/** Every patch in `dir`, in name order, each checked for shape. Throws on a malformed one. */
export function loadPatches(dir: string): DependencyPatch[] {
  if (!existsSync(dir)) return []
  const patches: DependencyPatch[] = []
  for (const name of readdirSync(dir)
    .filter(n => n.endsWith('.json'))
    .sort()) {
    const p = JSON.parse(readFileSync(join(dir, name), 'utf8')) as Partial<DependencyPatch>
    const where = `patches/${name}`
    for (const key of ['id', 'package', 'why', 'test'] as const) {
      if (typeof p[key] !== 'string' || p[key] === '') throw new Error(`${where}: no ${key}`)
    }
    if (!Array.isArray(p.edits) || p.edits.length === 0) throw new Error(`${where}: no edits`)
    for (const [i, e] of p.edits.entries()) {
      for (const key of ['file', 'find', 'replace'] as const) {
        if (typeof e[key] !== 'string' || e[key] === '')
          throw new Error(`${where}: edit ${i + 1} has no ${key}`)
      }
      // A replacement holding its own find would read as both applied and unapplied.
      if (e.replace.includes(e.find))
        throw new Error(`${where}: edit ${i + 1}'s replacement contains its find`)
    }
    patches.push(p as DependencyPatch)
  }
  return patches
}

/** Apply `patches` to `root`/node_modules, or with `check` only report what is not in place. */
export function applyPatches(
  root: string,
  patches: DependencyPatch[],
  opts: { check?: boolean } = {}
): PatchReport {
  const report: PatchReport = { applied: [], alreadyApplied: [], problems: [] }
  for (const p of patches) {
    const pkgDir = join(root, 'node_modules', p.package)
    const manifest = join(pkgDir, 'package.json')
    if (!existsSync(manifest)) {
      report.problems.push(
        `${p.id}: ${p.package} is not installed under ${join(root, 'node_modules')}`
      )
      continue
    }
    const version =
      (JSON.parse(readFileSync(manifest, 'utf8')) as { version?: string }).version ?? '?'
    const at = `${p.package}@${version}`
    // Every edit is judged before any is written, so a patch is applied whole or not at all.
    const planned: { label: string; path: string; text: string | null }[] = []
    let refused = false
    for (const e of p.edits) {
      const label = `${p.id}: ${e.file}`
      const path = join(pkgDir, e.file)
      if (!existsSync(path)) {
        report.problems.push(`${label}: no such file in ${at}`)
        refused = true
        continue
      }
      const text = readFileSync(path, 'utf8')
      const old = occurrences(text, e.find)
      const now = occurrences(text, e.replace)
      if (old === 0 && now === 1) {
        planned.push({ label, path, text: null })
      } else if (old === 1 && now === 0) {
        planned.push({ label, path, text: text.replace(e.find, () => e.replace) })
      } else {
        refused = true
        report.problems.push(
          old > 1
            ? `${label}: the text it replaces appears ${old} times in ${at}, not once`
            : `${label}: ${at} holds neither the text this patch replaces nor its replacement. ` +
                `The release changed this code, perhaps fixing it: read the change, and retire the ` +
                `patch once ${p.test} passes without it, or derive it again`
        )
      }
    }
    if (refused) continue
    for (const step of planned) {
      if (step.text === null) {
        report.alreadyApplied.push(step.label)
      } else if (opts.check) {
        report.problems.push(`${step.label}: not applied (npm run patch:dependencies)`)
      } else {
        const temporary = `${step.path}.patching-${process.pid}`
        writeFileSync(temporary, step.text, { mode: statSync(step.path).mode })
        renameSync(temporary, step.path)
        report.applied.push(step.label)
      }
    }
  }
  return report
}

function main(): void {
  const check = process.argv.includes('--check')
  const code = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const report = applyPatches(code, loadPatches(join(code, 'patches')), { check })
  for (const line of report.applied) console.log(`  patched  ${line}`)
  for (const line of report.alreadyApplied) console.log(`  in place ${line}`)
  for (const line of report.problems) console.error(`  ✗ ${line}`)
  if (report.problems.length > 0) {
    console.error(
      `dependency patches: ${report.problems.length} problem(s); each patch in patches/ says why it exists and names its test`
    )
    process.exit(1)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
