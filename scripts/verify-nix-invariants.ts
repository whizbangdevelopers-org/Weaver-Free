// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:nix-invariants — the two Nix rules that ARE mechanically checkable.
 *
 * The project's Nix conventions were long treated as unmechanisable, on the grounds that
 * `audit:nix-deps-hash` checks a hash is current and cannot check that a launcher script avoided
 * an env-resolved interpreter, or that a flake input was pinned git-aware. That is true of the hash
 * auditor and it is not true of the invariants themselves — both are exact textual properties of
 * the Nix files, and both have a recorded failure behind them.
 *
 *   env-shebang     `#!/usr/bin/env bash` in a script written into `$out/bin/`. A Nix build has no
 *                   ambient PATH, so the interpreter must be a full store path
 *                   (`#!${pkgs.bash}/bin/bash`). The env form resolves at run time against whatever
 *                   the caller happens to have, which is the opposite of what the package promises.
 *
 *   flake-input-path  A `path:` flake input. `path:` is NOT git-aware — it copies the whole
 *                   directory including untracked build output, so a stray `result` symlink changes
 *                   the input's narHash and desynchronises every consumer. `git+file:` hashes
 *                   tracked content only. Recorded as G-nixos-2026-07-11-01KYSBXCJ9D8AMA0FFCR1FPZMZ.
 *
 * **Currently zero violations, and that is stated rather than hidden.** This is a regression guard
 * over a compliant surface — `package.nix` already writes `#!${pkgs.bash}/bin/bash` and `flake.nix`
 * pins only a `github:` input. It earns its place from the recorded incident rather than from a
 * live finding, which is the honest version of the argument; the negative test is what shows it
 * can fail at all.
 *
 * Usage:
 *   npx tsx scripts/verify-nix-invariants.ts
 *   npx tsx scripts/verify-nix-invariants.ts --self-test
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = resolve(HERE, '..')

const RED = '\x1b[31m'; const GREEN = '\x1b[32m'; const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'; const RESET = '\x1b[0m'

interface Rule { id: string; pattern: RegExp; why: string; fix: string }

const RULES: Rule[] = [
  {
    id: 'env-shebang',
    pattern: /#!\s*\/usr\/bin\/env\b/,
    why: 'a Nix build has no ambient PATH, so an env-resolved interpreter is whatever the caller happens to have',
    fix: 'use a full store path: #!${pkgs.bash}/bin/bash',
  },
  {
    id: 'flake-input-path',
    // `url = "path:./x"` or `url = path:./x`. Matches the scheme in an input position only.
    pattern: /\burl\s*=\s*"?path:/,
    why: 'path: is not git-aware — it copies untracked build output too, so a stray result symlink changes the narHash and desyncs consumers',
    fix: 'use git+file: to hash tracked content only (G-nixos-2026-07-11-01KYSBXCJ9D8AMA0FFCR1FPZMZ)',
  },
]

/**
 * Strip Nix comments so a rule cannot fire on prose describing it.
 *
 * The same lesson as audit:outbound-authz: the moment a rule exists, the codebase acquires
 * comments explaining it, and a line-based scan reports those as violations. `#` to end of line,
 * and `/* … *\/` blocks.
 */
export function stripNixComments(src: string): string {
  const out: string[] = []
  let inBlock = false
  for (const line of src.split('\n')) {
    let l = line
    if (inBlock) {
      const close = l.indexOf('*/')
      if (close === -1) { out.push(''); continue }
      l = l.slice(close + 2); inBlock = false
    }
    for (;;) {
      // A Nix block comment opens with `/*` at a COMMENT position — start of line or after
      // whitespace. A bare indexOf('/*') also matches a shell glob inside a `''…''` string, and
      // `installPhase` is full of them: `cp -r backend/dist/* $out/…`. That opened a block comment
      // that never closed and blanked the rest of the file, so a real `#!/usr/bin/env` shebang 40
      // lines below went unseen while the synthetic corpus — which had no globs in it — passed.
      // Found by reverting a real launcher rather than by the fixtures, which is the whole reason
      // to negative-test against the actual tree.
      const open = l.search(/(^|\s)\/\*/)
      if (open === -1) break
      const at = l.indexOf('/*', open)
      const close = l.indexOf('*/', at + 2)
      if (close === -1) { l = l.slice(0, at); inBlock = true; break }
      l = l.slice(0, at) + ' ' + l.slice(close + 2)
    }
    // A `#` comment — but `#!` is a shebang, which is the thing under test, and `${...#...}` is
    // Nix string interpolation. Only strip a `#` that is preceded by whitespace or line start and
    // not immediately followed by `!`.
    const c = l.search(/(^|\s)#(?!!)/)
    if (c !== -1) l = l.slice(0, c)
    out.push(l)
  }
  return out.join('\n')
}

export interface Finding { file: string; line: number; rule: string; why: string; fix: string; text: string }

export function scanNix(relPath: string, source: string): Finding[] {
  const code = stripNixComments(source).split('\n')
  const raw = source.split('\n')
  const out: Finding[] = []
  for (const rule of RULES) {
    code.forEach((line, i) => {
      if (rule.pattern.test(line)) {
        out.push({ file: relPath, line: i + 1, rule: rule.id, why: rule.why, fix: rule.fix, text: (raw[i] ?? '').trim() })
      }
    })
  }
  return out
}

function walkNix(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'result') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { walkNix(p, acc); continue }
    if (p.endsWith('.nix')) acc.push(p)
  }
  return acc
}

// --------------------------------------------------------------------------------------------
// Self-test
// --------------------------------------------------------------------------------------------

const CATCH_CASES: [string, string][] = [
  ['an env shebang in a launcher', `installPhase = ''\n  cat > $out/bin/x <<EOF\n  #!/usr/bin/env bash\n  EOF\n'';`],
  ['an env shebang with a space', `  #! /usr/bin/env bash`],
  ['an env shebang for another interpreter', `#!/usr/bin/env python3`],
  ['a quoted path: input', `weaver.url = "path:./nixos";`],
  ['a shebang AFTER a shell glob', `installPhase = ''\n  cp -r dist/* $out/lib/\n  cat > $out/bin/x <<EOF\n  #!/usr/bin/env bash\n  EOF\n'';`],
  ['an unquoted path: input', `inputs.weaver.url = path:./nixos;`],
]

const IGNORE_CASES: [string, string][] = [
  // The correct forms, which must never be flagged.
  ['a store-path shebang', '#!\${pkgs.bash}/bin/bash'],
  ['a git+file input', `weaver.url = "git+file:///home/x/repo?dir=code";`],
  ['a github input', `nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";`],
  // Prose describing the rules — the class that switches an auditor off.
  ['a comment banning the env shebang', `# NEVER use #!/usr/bin/env bash here — use \${pkgs.bash}`],
  ['a comment explaining path: vs git+file:', `# path: copies untracked output; use git+file: instead`],
  ['a block comment mentioning both', `/* url = "path:./x" is wrong and #!/usr/bin/env is too */`],
  ['a hash inside string interpolation', 'name = "\${lib.removePrefix "#" tag}";'],
  ['an unrelated url attribute', `src.url = "https://example.com/x.tar.gz";`],
  ['a shell glob, which is not a block comment', `cp -r backend/dist/* $out/lib/weaver/backend/`],
  ['a glob in a docs copy', `cp docs/security/compliance/*.md $out/lib/weaver/docs/`],
]

function selfTest(): boolean {
  const failures: string[] = []
  for (const [name, src] of CATCH_CASES) {
    if (scanNix('t.nix', src).length === 0) failures.push(`CATCH missed: ${name}`)
  }
  for (const [name, src] of IGNORE_CASES) {
    const hits = scanNix('t.nix', src)
    if (hits.length > 0) failures.push(`IGNORE wrongly flagged: ${name} (${hits.map(h => h.rule).join(', ')})`)
  }
  console.log(`${DIM}  auditor-contract: catch=${CATCH_CASES.length} ignore=${IGNORE_CASES.length}${RESET}`)
  if (failures.length > 0) {
    console.error(`${RED}${BOLD}SELF-TEST FAILED${RESET}`)
    for (const f of failures) console.error(`  ${RED}✗${RESET} ${f}`)
    return false
  }
  return true
}

// --------------------------------------------------------------------------------------------

function main(): void {
  const selfTestOnly = process.argv.includes('--self-test')

  console.log(`${BOLD}Nix Invariants${RESET}`)
  console.log(`${DIM}store-path interpreters, and git-aware flake inputs${RESET}\n`)

  if (!selfTest()) {
    console.error(`\n${RED}${BOLD}RESULT: FAIL${RESET} — refusing to scan on a failed self-test`)
    process.exit(1)
  }
  if (selfTestOnly) {
    console.log(`\n${GREEN}${BOLD}SELF-TEST PASSED${RESET}`)
    return
  }

  const files = [...walkNix(join(PKG, 'nixos'))]
  const flake = join(PKG, 'flake.nix')
  if (existsSync(flake)) files.push(flake)

  // Refuse over an empty universe: "no .nix files" and "no violations" must not print the same tick.
  if (files.length === 0) {
    console.error(`${RED}✗${RESET} no .nix files found under nixos/ — refusing to report`)
    process.exit(1)
  }

  const findings = files.flatMap(f => scanNix(relative(PKG, f), readFileSync(f, 'utf-8')))
  console.log(`${DIM}  ${files.length} nix file(s) · ${RULES.length} invariant(s)${RESET}`)

  if (findings.length > 0) {
    console.error('')
    for (const f of findings) {
      console.error(`  ${RED}✗${RESET} ${f.file}:${f.line} [${BOLD}${f.rule}${RESET}] — ${f.why}`)
      console.error(`      ${DIM}${f.text}${RESET}`)
      console.error(`      ${DIM}fix: ${f.fix}${RESET}`)
    }
    console.error(`\n${RED}${BOLD}RESULT: FAIL${RESET} — ${findings.length} Nix invariant violation(s)`)
    process.exit(1)
  }

  console.log(`\n${GREEN}${BOLD}RESULT: PASS${RESET} — interpreters are store paths and flake inputs are git-aware`)
}

main()
