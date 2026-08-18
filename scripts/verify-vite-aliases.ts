// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:vite-aliases — the dev server must be able to resolve every aliased import.
 *
 * WHY THIS EXISTS
 * ---------------
 * `@quasar/app-vite` 3 dropped the built-in `src` / `app` / `components` / `layouts` / `pages` /
 * `assets` / `boot` / `stores` aliases and ships only `@` and `#q-app`. Every project scaffolded
 * from this template imports through the dropped prefixes, so the upgrade left the dev server
 * unable to resolve a single store or layout — the app did not mount at all.
 *
 * Nothing caught it. `vue-tsc` reads tsconfig's own copy of the path map and stayed green. The
 * production build resolves through the same tsconfig and stayed green. `npm run build` passed,
 * compliance passed, units passed. The only gate that could have seen it was E2E, which had never
 * been run against the upgrade. The real ladder is typecheck < build < DEV SERVER, and the top
 * rung had no cheap guard at all. This is that guard.
 *
 * WHAT IT ASSERTS — and why each leg is a different question
 * ---------------------------------------------------------
 *   1. DERIVABLE  — tsconfig's `compilerOptions.paths` yields a non-empty alias map.
 *   2. WIRED      — the repo's own quasar.config.js is LOADED and invoked, and the `build.alias`
 *                   it actually hands Quasar equals that derivation. This is the consumer-side
 *                   leg: a module that derives aliases perfectly and is never imported looks
 *                   identical, from the provider side, to one that is. Reading the config's
 *                   source text for an `alias:` key would be the provider-side check again.
 *   3. REAL       — every alias points at a directory that exists.
 *   4. COMPLETE   — every prefix the source actually imports through is a key in that map. Leg 2
 *                   passing with a map missing `layouts` is still a dead dev server.
 *
 * SELF-TEST
 * ---------
 * `--self-test` proves the parser and the derivation can fail in both directions, and prints the
 * machine-readable contract line (`auditor-contract: catch=<n> ignore=<n>`) that the
 * auditor-contract checker reads, so both halves are visible rather than merely asserted. The IGNORE half is the load-bearing one here: the derivation reads
 * JSONC, because a tsconfig may legitimately carry comments, and a comment stripper that also
 * eats `//` inside a string value corrupts real config silently. A checker that mangles valid
 * input gets switched off, after which it catches nothing at all.
 *
 * The default run executes the corpus FIRST and refuses to report if it fails.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  deriveViteAliases,
  parseJsonc,
  stripJsonComments,
  stripTrailingCommas,
} from '../quasar.aliases.js'

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Client source must not read `process.env` — app-vite 3 does not define `process` in the dev
 * server.
 *
 * Same defect class as the alias break above, which is why this auditor covers both: invisible to
 * typecheck, invisible to the production build, fatal in the dev server. It is worth stating how
 * quietly it fails, because that is what let it survive in FOUR repositories at once:
 *
 *   - In the BUILD, Vite statically replaces `process.env.X` with undefined. The router's
 *     ternaries then fall through to `createWebHashHistory(undefined)`, which HAPPENS to equal the
 *     configured `vueRouterMode: 'hash'` and `publicPath: '/'`. Production is correct by
 *     coincidence, not by instruction.
 *   - In the DEV server nothing defines `process` at all, so the module throws
 *     `ReferenceError: process is not defined` at import time and the app never mounts.
 *
 * The symptom is a page whose `#q-app` exists and is HIDDEN, which reads as a CSS or timing
 * problem rather than as a module that threw.
 *
 * `import.meta.env` is the replacement: `QUASAR_SERVER`, `QUASAR_VUE_ROUTER_MODE`,
 * `QUASAR_VUE_ROUTER_BASE` (verified against the installed package — quasar-config-file.js and
 * modes/ssr/ssr-config.js define them), plus Vite's own `DEV` / `PROD` / `MODE`.
 *
 * Scope is CLIENT source only. Build scripts and anything under scripts/ legitimately read
 * process.env, and flagging those would make this a rule people switch off.
 *
 * Comments and quoted strings are stripped first. Both matter: this trap is DOCUMENTED in comments
 * that necessarily contain the token, and the error message a developer would sensibly write
 * ("process.env is not defined") contains it too. Template literals are deliberately NOT stripped,
 * because `${process.env.X}` inside one is a real read.
 *
 * @param files client source files
 */
export function findProcessEnvInClient(
  files: Array<{ name: string; text: string }>,
): Array<{ file: string; line: number; text: string }> {
  const hits: Array<{ file: string; line: number; text: string }> = []

  for (const f of files) {
    const lines = f.text.split('\n')
    let inBlockComment = false

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      let line = raw

      if (inBlockComment) {
        const end = line.indexOf('*/')
        if (end === -1) continue
        line = line.slice(end + 2)
        inBlockComment = false
      }

      // Strip quoted spans and comments in one left-to-right pass, so a `//` inside a string is
      // not a comment and a quote inside a comment does not open a string.
      let out = ''
      let quote = null
      for (let k = 0; k < line.length; k++) {
        const c = line[k]
        if (quote) {
          if (c === '\\') { k++; continue }
          if (c === quote) quote = null
          continue
        }
        if (c === '"' || c === "'") { quote = c; continue }
        if (c === '/' && line[k + 1] === '/') break
        if (c === '/' && line[k + 1] === '*') {
          const end = line.indexOf('*/', k + 2)
          if (end === -1) { inBlockComment = true; break }
          k = end + 1
          continue
        }
        out += c
      }

      if (/\bprocess\s*\.\s*env\b/.test(out)) {
        hits.push({ file: f.name, line: i + 1, text: raw.trim().slice(0, 100) })
      }
    }
  }

  return hits
}

// ── The corpus ────────────────────────────────────────────────────────────────────────────────
//
// CATCH — input the derivation MUST reject. IGNORE — input it MUST accept unchanged.

type Case = { name: string; tsconfig: string; expect?: Record<string, string> }

const CATCH_CASES: Case[] = [
  {
    name: 'no compilerOptions at all',
    tsconfig: '{ "include": ["src/**/*.ts"] }',
  },
  {
    name: 'paths present but empty',
    tsconfig: '{ "compilerOptions": { "paths": {} } }',
  },
  {
    name: 'only #q-app entries — nothing app-vite does not already provide',
    tsconfig: `{ "compilerOptions": { "paths": {
      "#q-app": ["./node_modules/@quasar/app-vite/types/index.d.ts"],
      "#q-app/*": ["./node_modules/@quasar/app-vite/types/*"]
    } } }`,
  },
  {
    name: 'only exact (non-wildcard) mappings — no safe Vite equivalent',
    tsconfig: '{ "compilerOptions": { "paths": { "app-config": ["./src/config.ts"] } } }',
  },
  {
    name: 'wildcard key mapped to a non-wildcard target — would truncate silently',
    tsconfig: '{ "compilerOptions": { "paths": { "src/*": ["./src"] } } }',
  },
  {
    name: 'target is not a string',
    tsconfig: '{ "compilerOptions": { "paths": { "src/*": [null] } } }',
  },
  {
    name: 'malformed JSON',
    tsconfig: '{ "compilerOptions": { "paths": { "src/*": ["./src/*"] } }',
  },
  {
    name: 'unterminated block comment',
    tsconfig: '{ /* "compilerOptions": { "paths": { "src/*": ["./src/*"] } } }',
  },
  {
    name: 'paths declared only in an extended config — extends is not followed',
    tsconfig: '{ "extends": "./tsconfig.base.json", "compilerOptions": {} }',
  },
]

const IGNORE_CASES: Case[] = [
  {
    name: 'plain JSON',
    tsconfig: '{ "compilerOptions": { "paths": { "src/*": ["./src/*"] } } }',
    expect: { src: join('/app', 'src') },
  },
  {
    name: 'line comments (the form that broke the first port of this fix)',
    tsconfig: `{
      "compilerOptions": {
        // the app's own sources
        "paths": { "src/*": ["./src/*"] } // trailing note
      }
    }`,
    expect: { src: join('/app', 'src') },
  },
  {
    name: 'block comments, including a multi-line one',
    tsconfig: `{
      "compilerOptions": {
        /* why these exist:
           app-vite 3 dropped them */
        "paths": { "src/*": ["./src/*"] }
      }
    }`,
    expect: { src: join('/app', 'src') },
  },
  {
    name: 'a // sequence INSIDE a string value is data, not a comment',
    tsconfig: `{
      "compilerOptions": {
        "paths": { "src/*": ["./src/*"] },
        "_docs": "https://example.test/quasar#aliases"
      }
    }`,
    expect: { src: join('/app', 'src') },
  },
  {
    name: 'a block-comment opener inside a string value is data',
    tsconfig: `{ "compilerOptions": { "paths": { "src/*": ["./src/*"] }, "_glob": "**/*.ts" } }`,
    expect: { src: join('/app', 'src') },
  },
  {
    name: 'an escaped quote before a // sequence keeps the string open',
    tsconfig: `{ "compilerOptions": { "_note": "a \\" then // not a comment", "paths": { "src/*": ["./src/*"] } } }`,
    expect: { src: join('/app', 'src') },
  },
  {
    name: 'trailing commas, which tsconfig tolerates and JSON does not',
    tsconfig: `{
      "compilerOptions": {
        "paths": {
          "src/*": ["./src/*"],
          "stores/*": ["./src/stores/*"],
        },
      },
    }`,
    expect: { src: join('/app', 'src'), stores: join('/app', 'src', 'stores') },
  },
  {
    name: 'a comma inside a string is not a trailing comma',
    tsconfig: `{ "compilerOptions": { "_note": "one, two,", "paths": { "src/*": ["./src/*"] } } }`,
    expect: { src: join('/app', 'src') },
  },
  {
    name: '#q-app is skipped but does not suppress the real aliases',
    tsconfig: `{ "compilerOptions": { "paths": {
      "#q-app": ["./node_modules/@quasar/app-vite/types/index.d.ts"],
      "#q-app/*": ["./node_modules/@quasar/app-vite/types/*"],
      "layouts/*": ["./src/layouts/*"]
    } } }`,
    expect: { layouts: join('/app', 'src', 'layouts') },
  },
  {
    name: 'an exact mapping alongside wildcards is skipped, the wildcards survive',
    tsconfig: `{ "compilerOptions": { "paths": {
      "app-config": ["./src/config.ts"],
      "src/*": ["./src/*"]
    } } }`,
    expect: { src: join('/app', 'src') },
  },
  {
    name: 'baseUrl is honoured when present',
    tsconfig: '{ "compilerOptions": { "baseUrl": "./sub", "paths": { "src/*": ["./src/*"] } } }',
    expect: { src: join('/app', 'sub', 'src') },
  },
]

const ENV_CATCH = [
  ['a bare process.env read', 'const x = process.env.FOO\n'],
  ['the router history switch', 'const h = process.env.SERVER ? a : b\n'],
  ['a router base', 'history: createHistory(process.env.VUE_ROUTER_BASE)\n'],
  ['spaced out to dodge a naive grep', 'const x = process . env . FOO\n'],
  ['after a line comment ends', '// process.env is banned here\nconst x = process.env.FOO\n'],
  ['after a block comment closes on the same line', '/* note */ const x = process.env.FOO\n'],
  ['on the line that closes a multi-line block comment', '/*\n why\n*/ const x = process.env.FOO\n'],
  ['inside a template literal, which IS a real read', 'const u = `${process.env.BASE}/api`\n'],
]

const ENV_IGNORE = [
  ['import.meta.env is the correct form', 'const h = import.meta.env.QUASAR_SERVER\n'],
  ['a line comment naming it is documentation', '// use import.meta.env, never process.env\nconst x = 1\n'],
  ['a block comment naming it is documentation', '/*\n * process.env.VUE_ROUTER_MODE was the v2 form\n */\nconst x = 1\n'],
  ['a JSDoc block naming it', '/**\n * app-vite 2 exposed these as process.env\n */\nexport const x = 1\n'],
  ['a single-quoted error message naming it', "throw new Error('process.env is not defined')\n"],
  ['a double-quoted message naming it', 'const m = "read process.env at build time"\n'],
  ['an unrelated identifier', 'const postprocess = envs.process\n'],
  ['a quote inside a comment does not open a string', "// don't use process.env\nconst x = 1\n"],
  ['no env access at all', 'export const routes = []\n'],
]

function runCase(c: Case): Record<string, string> {
  return deriveViteAliases('/app', { read: () => c.tsconfig })
}

function selfTest(): boolean {
  const failures: string[] = []

  for (const c of CATCH_CASES) {
    let threw = false
    try {
      runCase(c)
    } catch {
      threw = true
    }
    if (!threw) failures.push(`CATCH missed: ${c.name}`)
  }

  for (const c of IGNORE_CASES) {
    try {
      const got = runCase(c)
      const want = c.expect ?? {}
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        failures.push(
          `IGNORE mis-derived: ${c.name}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`
        )
      }
    } catch (err) {
      failures.push(`IGNORE wrongly rejected: ${c.name} — ${(err as Error).message}`)
    }
  }

  // The primitives are also exercised directly: offsets must survive, because JSON.parse's
  // error positions are the only thing pointing a human at the bad line.
  //
  // Each assertion is wrapped, because a broken primitive THROWS rather than returning a wrong
  // answer — and an uncaught throw here would kill the run before the contract line is printed,
  // which reads to a caller as a crashed checker rather than as a failed corpus. A self-test that
  // cannot survive the bug it is testing for reports nothing about it.
  const direct: Array<[string, () => boolean]> = [
    [
      'stripJsonComments changed the source length — parse offsets would shift',
      () => {
        const withComment = '{ // note\n  "a": 1 }'
        return stripJsonComments(withComment).length === withComment.length
      },
    ],
    ['stripTrailingCommas left a trailing comma', () => !stripTrailingCommas('{"a":1,}').includes(',')],
    [
      'parseJsonc mangled a // sequence inside a string',
      () => (parseJsonc('{"a":"//x"}') as { a: string }).a === '//x',
    ],
    [
      'parseJsonc mangled a block-comment opener inside a string',
      () => (parseJsonc('{"a":"**/*.ts"}') as { a: string }).a === '**/*.ts',
    ],
  ]
  for (const [message, assertion] of direct) {
    try {
      if (!assertion()) failures.push(message)
    } catch (err) {
      failures.push(`${message} (threw: ${(err as Error).message})`)
    }
  }

  for (const [name, text] of ENV_CATCH) {
    if (findProcessEnvInClient([{ name: 'x.ts', text }]).length === 0) {
      failures.push(`CATCH missed (process.env): ${name}`)
    }
  }
  for (const [name, text] of ENV_IGNORE) {
    const hits = findProcessEnvInClient([{ name: 'x.ts', text }])
    if (hits.length > 0) failures.push(`IGNORE wrongly flagged (process.env): ${name} — line ${hits[0]!.line}`)
  }

  for (const f of failures) console.error(`  ✗ ${f}`)
  console.log(
    `auditor-contract: catch=${CATCH_CASES.length + ENV_CATCH.length} ` +
      `ignore=${IGNORE_CASES.length + ENV_IGNORE.length}`
  )
  return failures.length === 0
}

// ── The live checks ───────────────────────────────────────────────────────────────────────────

const CTX_STUB = {
  dev: false,
  prod: true,
  mode: { spa: true, pwa: false, ssr: false, bex: false, electron: false, capacitor: false, cordova: false },
  modeName: 'spa',
  target: {},
  targetName: undefined,
  arch: {},
  archName: undefined,
  bundlerName: undefined,
  debug: false,
  vueDevtools: false,
  publicPath: '/',
}

const SOURCE_DIRS = ['src', 'src-pwa', 'src-electron', 'src-capacitor', 'src-bex', 'src-ssr']

// The subset of the above that runs in a BROWSER. src-electron (main + preload) and src-ssr
// (server) execute in Node, where `process.env` is correct rather than fatal — so the env leg
// must not reach them, while the alias leg still must.
const CLIENT_DIRS = ['src', 'src-pwa', 'src-capacitor', 'src-bex']
const SOURCE_EXT = ['.ts', '.mts', '.js', '.mjs', '.vue']
const RESOLVE_EXT = ['', '.ts', '.mts', '.tsx', '.js', '.mjs', '.vue', '.json', '/index.ts', '/index.js', '/index.vue']

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (SOURCE_EXT.some((e) => full.endsWith(e))) out.push(full)
  }
  return out
}

/** Every module specifier a source file imports, however it spells the import. */
function importSpecifiers(source: string): string[] {
  const specs: string[] = []
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(source)) !== null) specs.push(m[1])
  }
  return specs
}

async function main(): Promise<void> {
  const selfTestOnly = process.argv.includes('--self-test')

  console.log('audit:vite-aliases — dev-server correctness: alias resolution + env access')

  const corpusOk = selfTest()
  if (!corpusOk) {
    console.error('\n✗ corpus FAILED — refusing to report on the repo, the checker is not trustworthy')
    process.exit(1)
  }
  if (selfTestOnly) {
    console.log('✓ self-test passed')
    return
  }

  const errors: string[] = []

  // 1. DERIVABLE
  let derived: Record<string, string>
  try {
    derived = deriveViteAliases(APP_DIR)
  } catch (err) {
    console.error(`\n✗ ${(err as Error).message}`)
    process.exit(1)
  }

  // 2. WIRED — load the config Quasar will actually load, and read what it hands over.
  const configPath = join(APP_DIR, 'quasar.config.js')
  if (!existsSync(configPath)) {
    console.error(`\n✗ ${configPath} not found`)
    process.exit(1)
  }

  let configured: Record<string, string> | undefined
  try {
    const mod = await import(pathToFileURL(configPath).href)
    const cfg = typeof mod.default === 'function' ? await mod.default(CTX_STUB) : mod.default
    configured = cfg?.build?.alias
  } catch (err) {
    console.error(`\n✗ quasar.config.js could not be loaded: ${(err as Error).message}`)
    process.exit(1)
  }

  if (!configured || Object.keys(configured).length === 0) {
    errors.push(
      'quasar.config.js sets no build.alias. app-vite 3 provides only `@` and `#q-app`, so every ' +
        'aliased import fails to resolve in the DEV SERVER while typecheck and the production ' +
        'build stay green. Set `alias: BUILD_ALIAS` from scripts/lib/tsconfig-aliases.js.'
    )
  } else {
    for (const [key, target] of Object.entries(derived)) {
      if (!(key in configured)) {
        errors.push(`build.alias is missing "${key}" (tsconfig maps it to ${target})`)
      } else if (resolve(configured[key]) !== resolve(target)) {
        errors.push(
          `build.alias["${key}"] = ${configured[key]}, but tsconfig maps it to ${target}. ` +
            `Derive it rather than hand-writing it — two copies of one map is what broke.`
        )
      }
    }

    // 3. REAL
    for (const [key, target] of Object.entries(configured)) {
      if (!existsSync(target)) {
        errors.push(`build.alias["${key}"] points at ${target}, which does not exist`)
      }
    }
  }

  // 4. COMPLETE — every prefix the source really imports through must be aliased.
  const tsconfigPaths = (
    parseJsonc(readFileSync(join(APP_DIR, 'tsconfig.json'), 'utf-8'), 'tsconfig.json') as {
      compilerOptions?: { paths?: Record<string, string[]> }
    }
  ).compilerOptions?.paths ?? {}

  const wildcardTargets = new Map<string, string>()
  for (const [key, targets] of Object.entries(tsconfigPaths)) {
    if (key === '#q-app' || key.startsWith('#q-app/') || !key.endsWith('/*')) continue
    const target = Array.isArray(targets) ? targets[0] : (targets as unknown as string)
    if (typeof target === 'string' && target.endsWith('/*')) {
      wildcardTargets.set(key.slice(0, -2), join(APP_DIR, target.slice(0, -2)))
    }
  }

  const used = new Map<string, string>() // prefix -> an example file that imports through it
  for (const dir of SOURCE_DIRS) {
    for (const file of walk(join(APP_DIR, dir))) {
      const source = readFileSync(file, 'utf-8')
      for (const spec of importSpecifiers(source)) {
        const head = spec.split('/')[0]
        const base = wildcardTargets.get(head)
        if (!base) continue
        // Only count it when the aliased path really resolves to a file on disk — otherwise a
        // dependency that happens to share a name with a source directory reads as an alias.
        const rest = spec.slice(head.length + 1)
        const hit = RESOLVE_EXT.some((ext) => existsSync(join(base, rest + ext)))
        if (hit && !used.has(head)) used.set(head, file.slice(APP_DIR.length + 1))
      }
    }
  }

  for (const [prefix, example] of used) {
    if (configured && !(prefix in configured)) {
      errors.push(`"${prefix}/..." is imported (e.g. ${example}) but is not in build.alias`)
    }
  }

  // Leg 5: client source must not read process.env — see findProcessEnvInClient for why this
  // belongs beside the alias check rather than in a security or lint rule. Same universe as leg 4.
  const clientFiles: Array<{ name: string; text: string }> = []
  for (const dir of CLIENT_DIRS) {
    for (const file of walk(join(APP_DIR, dir))) {
      clientFiles.push({ name: file.slice(APP_DIR.length + 1), text: readFileSync(file, 'utf-8') })
    }
  }
  for (const hit of findProcessEnvInClient(clientFiles)) {
    errors.push(
      `${hit.file}:${hit.line} reads process.env — app-vite 3 does not define \`process\` in the ` +
        `dev server, so this throws at import time and the app never mounts (the build silently ` +
        `replaces it with undefined). Use import.meta.env. → ${hit.text}`
    )
  }

  console.log(
    `  ${Object.keys(derived).length} aliases derived from tsconfig · ` +
      `${used.size} of them actually imported through · ` +
      `${Object.keys(configured ?? {}).length} wired into quasar.config.js`
  )

  if (errors.length > 0) {
    console.error('')
    for (const e of errors) console.error(`  ✗ ${e}`)
    console.error(`\n✗ audit:vite-aliases FAILED (${errors.length})`)
    process.exit(1)
  }

  console.log('✓ audit:vite-aliases passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
