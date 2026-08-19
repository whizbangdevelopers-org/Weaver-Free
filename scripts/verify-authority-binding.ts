// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// VENDORED from wbd-entitlement@bd8b407 — do not edit here.
// Edit upstream, re-run scripts/vendor-entitlement.ts. audit:entitlement-vendor fails on drift.

/**
 * Verification material must reach a product build ONLY from the generated authority module.
 *
 * ## Consuming products vendor this file rather than importing it
 *
 * A product's `scripts/` directory may ship to a public mirror, where this repo does not exist —
 * so a checker invoked from a sibling checkout would simply be absent there, which is the failure
 * mode of a control nobody notices: it never runs, and reports nothing. The copy is kept honest
 * by the consumer's own vendor auditor rather than by discipline.
 *
 * This is the auditor Weaver's `license-signing.ts` has claimed exists ever since verification
 * moved to an Ed25519 public key embedded in the product:
 *
 *   > "nothing here reads `process.env`, and an auditor asserts that no verification material
 *   >  reaches this module from config."
 *
 * It did not exist. Nothing under Weaver's `code/scripts/` referenced `ACCEPTED_PUBLIC_KEYS` or
 * `license-signing` except the two generator scripts, and `audit:license*` are all about
 * dependency licences and header parity. The comment was the specification and the code was the
 * gap — and where those two disagree the comment is usually right, because somebody reasoned
 * carefully enough to write it down.
 *
 * It becomes load-bearing exactly now. The build-time seam is the first *legitimate* path for a
 * public key to enter a build, which makes this the first moment someone could wire it to an
 * environment variable for convenience and have it look reasonable in review.
 *
 * ## The rule
 *
 * A file that calls `createVerifier(...)` must pass `ACCEPTED_PUBLIC_KEYS`, imported from the
 * generated authority module. Not a literal, not a config lookup, not a locally-built array.
 *
 * Deliberately strict: there is one binding site per product by design, so a rule that permits
 * exactly one shape costs nothing and leaves nothing to argue about at review time.
 *
 * **The strictness is what makes it work at all**, and that is not obvious until you watch it run.
 * This checker is argument-shaped, not dataflow-shaped: it reads the text of argument 2 and does
 * not trace where a variable came from. So laundering an environment read through one local —
 *
 *     const keys = (process.env.WEAVER_ACCEPTED_KEYS ?? '').split(',')
 *     createVerifier(profile, keys)
 *
 * — is reported as BINDING rather than CONFIG-SOURCED, because by the time the argument is read it
 * is just `keys`. It is still caught, and it would still be caught after ten hops, because
 * anything that is not the exact imported constant fails.
 *
 * A looser rule — "no `process.env` near a `createVerifier` call" — would have missed that
 * entirely, which is the version of this checker someone reaches for first. The CONFIG-SOURCED
 * rule exists only to give a better message in the direct case; BINDING is the one doing the work.
 *
 * ## Universe
 *
 * A product's SHIPPED source. Tests are excluded on purpose — they legitimately mint and verify
 * with ephemeral keypairs, and a checker whose universe is wider than its consumer's can only
 * ever produce false positives, which is how a rule gets switched off.
 *
 * USAGE
 *   tsx scripts/verify-authority-binding.ts --root <product-src> [--expect-binding]
 *   tsx scripts/verify-authority-binding.ts --self-test
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseArgs } from 'node:util'

interface Finding {
  rule: 'BINDING' | 'CONFIG-SOURCED' | 'NO-IMPORT' | 'ALIAS'
  file: string
  detail: string
}

const CONST = 'ACCEPTED_PUBLIC_KEYS'

/** Config-ish sources that must never produce verification material. */
const CONFIG_SOURCES = [
  /process\s*\.\s*env/,
  /readFileSync|readFile|createReadStream/,
  /process\s*\.\s*argv/,
  /\bconfig\s*[.[]/,
  /getenv|dotenv/,
]

/**
 * Matches a `createVerifier` CALL, including an explicit type argument.
 *
 * The `<...>` group is not cosmetic and its absence was a live bypass. `createVerifier` is
 * generic (`createVerifier<TTier>`), so `createVerifier<TierName>(profile, keys)` is the natural
 * way to write the call the moment a product wants its tier union stated — and against
 * `/\bcreateVerifier\s*\(/` that form is not a call at all. It is INVISIBLE, not merely
 * unjudged: the scanner reported `clean (1 binding site(s) checked)` on a tree whose second
 * binding read its keys from `process.env`.
 *
 * `--expect-binding` does not cover this. It asserts at least one site exists, and the product's
 * canonical binding already satisfies it, so an ADDITIONAL evasive site passes with exit 0.
 *
 * One level of generic nesting is tolerated (`<Map<string, T>>`); deeper is not, and would be
 * reported as a missing call site rather than silently accepted, because the shape below cannot
 * match a partial `<`.
 *
 * Declared ONCE and shared with the call-site counter at the bottom of this file. Those two used
 * to be separate literals, which is the same drift this checker exists to prevent, one level up.
 */
const CALL_RE_SOURCE = String.raw`\bcreateVerifier\s*(?:<[^<>]*(?:<[^<>]*>[^<>]*)*>)?\s*\(`

/** A fresh matcher each time — a shared `/g` regex carries `lastIndex` between callers. */
export function callRegex(): RegExp {
  return new RegExp(CALL_RE_SOURCE, 'g')
}

/**
 * Is the match at `index` the DECLARATION of `createVerifier` rather than a call to it?
 *
 * `export function createVerifier<TTier extends string>(` is textually a call once type arguments
 * are matched — the parameter list even parses into plausible "arguments", whose second is
 * `acceptedKeys: readonly string[]`. Reported as a BINDING finding, that is the library being
 * flagged for declaring the very parameter this rule exists to constrain.
 *
 * It went unnoticed before only because the declaration is ALWAYS generic, so the old
 * `\bcreateVerifier\s*\(` never matched it. Widening the pattern to close the generic bypass
 * therefore exposed this immediately — and a rule that flags the library it ships beside gets
 * switched off, after which it catches nothing at all.
 */
export function isDeclaration(source: string, index: number): boolean {
  return /\b(?:function|const|let|var)\s+$/.test(source.slice(Math.max(0, index - 40), index))
}

/**
 * Remove import/export specifiers so a mentioned name is not mistaken for a value use.
 *
 * `import { createVerifier } from '…'` binds the name; it does not alias it. The brace class
 * spans newlines deliberately, because a multi-line specifier list is the common formatting.
 */
export function stripModuleSpecifiers(source: string): string {
  return source
    .replace(/\b(?:import|export)\s+(?:type\s+)?\{[^}]*\}(?:\s*from\s*['"][^'"]*['"])?/g, '')
    .replace(/\bimport\s+(?:type\s+)?\w+\s+from\s*['"][^'"]*['"]/g, '')
    .replace(/\bexport\s+\*\s*(?:as\s+\w+\s*)?from\s*['"][^'"]*['"]/g, '')
}

/**
 * Every `createVerifier` mention that is neither a call nor a declaration nor an import.
 *
 * This is the ALIAS rule, and it exists because the checker is argument-shaped: `const cv =
 * createVerifier` moves the call out of reach of every pattern above, and `cv(profile, keys)`
 * then binds whatever it likes. Verified as a live bypass before this was written — the scanner
 * reported `clean (1 binding site(s) checked)` on a tree containing exactly that.
 *
 * Deliberately coarse. There is no legitimate reason to reference this function without calling
 * it, so any other mention is worth a human look; the cost of the rule is a sentence of
 * explanation at the one site that ever trips it legitimately.
 */
export function aliasMentions(source: string): string[] {
  const stripped = stripModuleSpecifiers(source)
  const out: string[] = []
  const re = /\bcreateVerifier\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(stripped))) {
    if (isDeclaration(stripped, m.index)) continue
    const tail = stripped.slice(m.index)
    if (new RegExp(`^${CALL_RE_SOURCE}`).test(tail)) continue
    out.push(stripped.slice(m.index, m.index + 60).split('\n')[0]!.trim())
  }
  return out
}

/**
 * Extract the second argument of each `createVerifier(...)` call.
 *
 * Splits on top-level commas so a profile expression containing its own parens or commas does not
 * confuse the boundary. Returns the raw text of argument 2, which the caller then judges.
 */
/**
 * Does this file contain a real `createVerifier` CALL — not merely its declaration?
 *
 * `--expect-binding` asks "could this scan have caught anything?", and the vendored library's own
 * declaration must not be allowed to answer yes. Counting it would let a product with no binding
 * at all pass the one guard that exists to reject a vacuous clean.
 */
export function hasBindingCall(source: string): boolean {
  const re = callRegex()
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    if (!isDeclaration(source, m.index)) return true
  }
  return false
}

export function verifierSecondArgs(source: string): string[] {
  const out: string[] = []
  const re = callRegex()
  let m: RegExpExecArray | null

  while ((m = re.exec(source))) {
    if (isDeclaration(source, m.index)) continue
    let depth = 1
    let i = m.index + m[0].length
    const args: string[] = []
    let cur = ''
    while (i < source.length && depth > 0) {
      const ch = source[i]!
      if (ch === '(' || ch === '[' || ch === '{') depth++
      else if (ch === ')' || ch === ']' || ch === '}') {
        depth--
        if (depth === 0) break
      }
      if (ch === ',' && depth === 1) {
        args.push(cur)
        cur = ''
      } else {
        cur += ch
      }
      i++
    }
    args.push(cur)
    if (args.length >= 2) out.push(args[1]!.trim())
  }
  return out
}

/** Strip comments so a mention of createVerifier in prose is not treated as a call. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/**
 * Blank out string-literal CONTENTS, keeping the quotes.
 *
 * Needed because `log('createVerifier(p, config)')` is data, not a call — the corpus caught that
 * as a false positive before this checker was trusted, which is the entire reason the IGNORE half
 * exists. A rule that flags a log line gets switched off, and then it catches nothing at all.
 *
 * Applied only to the call-detection view. Import detection needs the module path intact, so it
 * reads the comments-stripped source instead.
 */
export function stripStringContents(source: string): string {
  return source
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

/** Is this file's `ACCEPTED_PUBLIC_KEYS` imported from a generated authority module? */
export function importsFromAuthority(source: string): boolean {
  const re = new RegExp(
    `import\\s*\\{[^}]*\\b${CONST}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`,
    'g',
  )
  for (const m of source.matchAll(re)) {
    if (/authority/i.test(m[1]!)) return true
  }
  return false
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|js|mjs|cjs)$/.test(entry) && !/\.(test|spec)\.[tj]s$/.test(entry)) out.push(full)
  }
  return out
}

export function analyse(source: string): Finding[] {
  const findings: Omit<Finding, 'file'>[] = []
  const code = stripComments(source)
  // Two views on purpose: calls are found with string contents blanked (so a log line is not a
  // call), imports are matched against the comments-only view (so the module path survives).
  const args = verifierSecondArgs(stripStringContents(code))

  for (const arg of args) {
    if (arg === CONST) continue

    if (CONFIG_SOURCES.some((re) => re.test(arg))) {
      findings.push({
        rule: 'CONFIG-SOURCED',
        detail:
          `createVerifier receives '${arg}', which reads runtime configuration. ` +
          'Verification material the restricted party supplies is not verification.',
      })
    } else {
      findings.push({
        rule: 'BINDING',
        detail:
          `createVerifier receives '${arg}' — must be ${CONST} from the generated authority module`,
      })
    }
  }

  for (const mention of aliasMentions(code)) {
    findings.push({
      rule: 'ALIAS',
      detail:
        `'${mention}' references createVerifier without calling it. Aliasing moves the call out ` +
        'of this checker\'s reach; call it directly at the binding site.',
    })
  }

  if (args.length > 0 && args.some((a) => a === CONST) && !importsFromAuthority(code)) {
    findings.push({
      rule: 'NO-IMPORT',
      detail: `${CONST} is used but not imported from a generated authority module`,
    })
  }

  return findings as Finding[]
}

// ---------------------------------------------------------------------------
// Corpus — both halves, and the scanner refuses to report unless it passes.
// ---------------------------------------------------------------------------

interface Case {
  name: string
  source: string
  catches: boolean
}

const IMPORT_LINE = `import { ACCEPTED_PUBLIC_KEYS } from './generated/authority.js'\n`

const CASES: Case[] = [
  // CATCH — every one of these is a way an operator ends up choosing what the build trusts.
  { name: 'env var', source: `createVerifier(p, process.env.KEYS!.split(','))`, catches: true },
  { name: 'config object', source: `createVerifier(p, config.license.acceptedKeys)`, catches: true },
  { name: 'read from disk', source: `createVerifier(p, readFileSync(f,'utf8').split('\\n'))`, catches: true },
  { name: 'inline array literal', source: `createVerifier(p, ['AAAA'])`, catches: true },
  { name: 'locally built array', source: `const ks = [a,b]\ncreateVerifier(p, ks)`, catches: true },
  { name: 'argv', source: `createVerifier(p, process.argv.slice(2))`, catches: true },
  { name: 'empty literal', source: `createVerifier(p, [])`, catches: true },
  { name: 'function call', source: `createVerifier(p, loadKeys())`, catches: true },
  { name: 'const used without the import', source: `createVerifier(p, ACCEPTED_PUBLIC_KEYS)`, catches: true },
  { name: 'imported from the wrong module', source: `import { ACCEPTED_PUBLIC_KEYS } from './config.js'\ncreateVerifier(p, ACCEPTED_PUBLIC_KEYS)`, catches: true },

  // CATCH — the generic call form. `createVerifier` IS generic, so a product stating its tier
  // union writes it this way naturally; before the type-argument group these were invisible to
  // the scanner, which then reported the file clean rather than unjudged.
  { name: 'generic form + env', source: `createVerifier<TierName>(p, process.env.KEYS!.split(','))`, catches: true },
  { name: 'generic form + literal', source: `createVerifier<Tier>(p, ['AAAA'])`, catches: true },
  { name: 'generic form + config', source: `createVerifier<T>(p, config.license.acceptedKeys)`, catches: true },
  { name: 'generic form, spaced', source: `createVerifier <TierName> (p, loadKeys())`, catches: true },
  { name: 'nested generic + env', source: `createVerifier<Map<string, Tier>>(p, process.env.KEYS!.split(','))`, catches: true },

  // CATCH — aliasing. Verified as a live bypass: the scanner reported a tree containing exactly
  // this as `clean (1 binding site(s) checked)`, because by the time the call is written the
  // callee is a local and no pattern above can see it.
  { name: 'aliased to a local, then called', source: `const cv = createVerifier\ncv(p, process.env.KEYS!.split(','))`, catches: true },
  { name: 'aliased via destructuring', source: `const { createVerifier: mk } = lib\nmk(p, loadKeys())`, catches: true },
  { name: 'passed as a value', source: `register(createVerifier)`, catches: true },

  // IGNORE — legitimate input. A rule that flags these gets switched off, and then it catches
  // nothing at all.
  { name: 'the canonical form', source: `${IMPORT_LINE}createVerifier(profile, ACCEPTED_PUBLIC_KEYS)`, catches: false },
  { name: 'canonical, multi-line', source: `${IMPORT_LINE}createVerifier(\n  profile,\n  ACCEPTED_PUBLIC_KEYS,\n)`, catches: false },
  { name: 'profile expression with its own parens', source: `${IMPORT_LINE}createVerifier(defineProfile({a:1}), ACCEPTED_PUBLIC_KEYS)`, catches: false },
  { name: 'mentioned in a line comment', source: `// call createVerifier(p, process.env.X) — never do this`, catches: false },
  { name: 'mentioned in a block comment', source: `/*\n createVerifier(p, ['literal'])\n*/`, catches: false },
  { name: 'a file that never calls it', source: `${IMPORT_LINE}export const x = ACCEPTED_PUBLIC_KEYS.length`, catches: false },
  { name: 'unrelated env read', source: `${IMPORT_LINE}const port = process.env.PORT\ncreateVerifier(p, ACCEPTED_PUBLIC_KEYS)`, catches: false },
  { name: 'the word in a string', source: `log('createVerifier(p, config)')`, catches: false },
  { name: 'generic form, canonical', source: `${IMPORT_LINE}createVerifier<TierName>(WEAVER_PROFILE, ACCEPTED_PUBLIC_KEYS)`, catches: false },
  { name: 'generic form, canonical, multi-line', source: `${IMPORT_LINE}createVerifier<TierName>(\n  profile,\n  ACCEPTED_PUBLIC_KEYS,\n)`, catches: false },
  { name: 'a less-than that is not a type argument', source: `${IMPORT_LINE}const ok = a < b\ncreateVerifier(p, ACCEPTED_PUBLIC_KEYS)`, catches: false },

  // The library's own DECLARATION. Textually a generic call, and the second "argument" parses as
  // `acceptedKeys: readonly string[]` — so widening the pattern for generics flagged the very
  // function this rule constrains, until isDeclaration() was added.
  { name: 'the declaration itself', source: `export function createVerifier<TTier extends string>(\n  profile: ProductProfile<TTier>,\n  acceptedKeys: readonly string[],\n): Verifier<TTier> {}`, catches: false },
  { name: 'importing the name is not aliasing it', source: `import { createVerifier } from './verify/verifier.js'\n${IMPORT_LINE}createVerifier(p, ACCEPTED_PUBLIC_KEYS)`, catches: false },
  { name: 'multi-line import specifier', source: `import {\n  createVerifier,\n  type LicenseResult,\n} from './verify/verifier.js'\n${IMPORT_LINE}createVerifier(p, ACCEPTED_PUBLIC_KEYS)`, catches: false },
  { name: 're-exporting the name', source: `export { createVerifier } from './verify/verifier.js'`, catches: false },
]

function selfTest(): string[] {
  const failures: string[] = []
  for (const c of CASES) {
    const hit = analyse(c.source).length > 0
    if (hit !== c.catches) {
      failures.push(`  ${c.catches ? 'MISSED' : 'FALSE POSITIVE'}: ${c.name}`)
    }
  }
  return failures
}

// ---------------------------------------------------------------------------

const { values } = parseArgs({
  options: {
    root: { type: 'string' },
    'expect-binding': { type: 'boolean' },
    'self-test': { type: 'boolean' },
  },
})

const corpusFailures = selfTest()
if (corpusFailures.length > 0) {
  console.error('audit:authority-binding — CORPUS FAILED, refusing to scan:')
  console.error(corpusFailures.join('\n'))
  process.exit(1)
}
const catchCount = CASES.filter((c) => c.catches).length
console.log(`corpus ok — ${catchCount} catch / ${CASES.length - catchCount} ignore`)
// The auditor-contract protocol: a consuming repo's contract checker reads this line to confirm
// BOTH halves of the corpus are non-empty, rather than trusting that they exist. Printed rather
// than exported so the same check works for an auditor written in any language. The IGNORE count
// matters as much as the CATCH one — a rule that flags everything gets switched off on its first
// real run, after which it catches nothing at all.
console.log(`auditor-contract: catch=${catchCount} ignore=${CASES.length - catchCount}`)

if (values['self-test']) process.exit(0)

if (!values.root) {
  console.error('audit:authority-binding: --root <product-src> is required (or --self-test)')
  process.exit(2)
}

const findings: Finding[] = []
let bindingSites = 0

for (const file of walk(values.root)) {
  const source = readFileSync(file, 'utf-8')
  if (hasBindingCall(stripStringContents(stripComments(source)))) bindingSites++
  for (const f of analyse(source)) {
    findings.push({ ...f, file: relative(values.root, file) })
  }
}

// "Clean" must not be able to mean "there was nothing here to look at". A scan that finds no
// binding site is answering a different question from the one the caller asked, and a green tick
// on that is worse than a failure because a reader trusts it.
if (values['expect-binding'] && bindingSites === 0) {
  console.error(
    `\naudit:authority-binding — no createVerifier call site found under ${values.root}.\n` +
      '  --expect-binding was passed, so this is a failure: the scan could not have caught\n' +
      '  anything, which is not the same as having found nothing.',
  )
  process.exit(1)
}

if (findings.length > 0) {
  console.error(`\naudit:authority-binding — ${findings.length} finding(s):\n`)
  for (const f of findings) console.error(`  [${f.rule}] ${f.file}\n      ${f.detail}`)
  console.error('')
  process.exit(1)
}

console.log(`audit:authority-binding — clean (${bindingSites} binding site(s) checked)`)
