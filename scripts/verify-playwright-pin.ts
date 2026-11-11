// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:playwright-pin — the Playwright client and the images it runs against are ONE version.
 *
 * WHY THIS EXISTS
 * ---------------
 * A Playwright release expects its own browser build. A client ahead of its image does not fail
 * a test; it fails to LAUNCH (`browserType.launch: Executable doesn't exist at
 * /ms-playwright/chromium_headless_shell-1243/...`), before any case runs.
 *
 * On 2026-09-16 a sibling product's Dependabot minor-and-patch group moved `@playwright/test`
 * 1.58.2 -> 1.63.0 while its runner images stayed at 1.58.2. Every E2E case died that way, and
 * nothing noticed, because no automated gate ran E2E. The version lived in three hand-kept places,
 * and the first automated edit split them. This repository went further: until 2026-11-10 it did
 * not declare `@playwright/test` at all, so the harness could not start, while its Dockerfile asked
 * to be kept "in sync with @playwright/test in package-lock.json".
 *
 * WHAT IT CHECKS
 * --------------
 *   1. `@playwright/test` is declared at an EXACT version in code/package.json — a range lets a
 *      lockfile refresh move it without a diff anyone reads as a Playwright change;
 *   2. the lockfile resolves `@playwright/test`, `playwright` and `playwright-core` to that version;
 *   3. every Playwright image the harness builds FROM (`config/Dockerfile*`) carries that version,
 *      and there is at least one — no image means nothing was compared;
 *   4. `.github/dependabot.yml` holds `@playwright/test` on the /code entry at EVERY update type,
 *      because a majors-only hold is exactly what let the 2026-09-16 bump through.
 *
 * WHAT IT DOES NOT CHECK
 * ----------------------
 * A browser pinned outside this repository (a fleet host's long-lived CDP browser, say). Reading
 * another repository here would make this repo's push depend on a checkout of it, and the chain
 * must run from any clone. A base image named in a Dockerfile here stands in for it.
 *
 *   npm run audit:playwright-pin
 *   npx tsx scripts/verify-playwright-pin.ts --self-test
 */

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { load } from 'js-yaml'

// The package root is this script's parent; the repository root is git's, never assumed to be one
// level up: a consumer whose package root sits deeper (code/<app>/) keeps .github/ two levels up,
// and its Dependabot entry names that deeper directory.
const CODE = resolve(import.meta.dirname, '..')
const REPO = execFileSync('git', ['-C', CODE, 'rev-parse', '--show-toplevel'], {
  encoding: 'utf-8'
}).trim()
const CODE_DIR = `/${relative(REPO, CODE)}`
const DOCKER_CONFIG = join(CODE, 'testing', 'e2e-docker', 'config')
const PKG = '@playwright/test'
const LOCKED = ['@playwright/test', 'playwright', 'playwright-core']

const RED = '\x1b[31m'
const GRN = '\x1b[32m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const OFF = '\x1b[0m'

export interface PinInputs {
  /** The spec as written in package.json, or undefined when not declared. */
  spec: string | undefined
  /** Resolved versions from the lockfile, by package name. */
  locked: Record<string, string | undefined>
  /** Every `FROM` in the harness Dockerfiles that names a Playwright image. */
  images: { file: string; ref: string; version: string | undefined }[]
  /** The package root's Dependabot entry's hold on the package: absent, or the update types it lists. */
  hold: { present: boolean; updateTypes?: string[]; directory?: string }
}

const EXACT = /^\d+\.\d+\.\d+$/

/** Every disagreement, as sentences. Empty means the pin holds. */
export function pinFindings(i: PinInputs): string[] {
  const out: string[] = []
  if (!i.spec) {
    out.push(`${PKG} is not declared in code/package.json — nothing to pin the images to`)
    return out
  }
  if (!EXACT.test(i.spec)) {
    out.push(
      `${PKG} is declared as "${i.spec}"; it must be an exact version, because a range lets the lockfile move it silently`
    )
  }
  const want = i.spec.replace(/^[^\d]*/, '')
  for (const name of LOCKED) {
    const got = i.locked[name]
    if (got !== want)
      out.push(`the lockfile resolves ${name} to ${got ?? '(nothing)'}, not ${want}`)
  }
  if (i.images.length === 0) {
    out.push('no Playwright image found in the harness Dockerfiles — nothing was compared')
  }
  for (const img of i.images) {
    if (img.version !== want) {
      out.push(
        `${img.file} builds FROM ${img.ref}, which is Playwright ${img.version ?? '(no version in the tag)'}, not ${want}`
      )
    }
  }
  if (!i.hold.present) {
    out.push(
      `.github/dependabot.yml does not hold ${PKG} on the ${i.hold.directory ?? '/code'} entry, so a grouped update can move it away from the images`
    )
  } else if (i.hold.updateTypes && i.hold.updateTypes.length > 0) {
    out.push(
      `.github/dependabot.yml holds ${PKG} only for ${i.hold.updateTypes.join(', ')}; a minor bump broke a sibling's E2E, so the hold must cover every update type`
    )
  }
  return out
}

/**
 * `FROM <ref>` lines naming a Playwright image, with the version parsed out of the tag. A
 * `${NAME}` or `$NAME` in the ref takes the default of an `ARG NAME=<value>` declared earlier in the
 * file, as docker builds it when no --build-arg is passed: a base image written
 * `FROM …/playwright:v${PLAYWRIGHT_VERSION}-jammy` is compared at that default. An ARG with no
 * default leaves the ref unresolved, and so reads as a tag with no version.
 */
export function playwrightImages(file: string, text: string): PinInputs['images'] {
  const out: PinInputs['images'] = []
  const args = new Map<string, string>()
  for (const line of text.split('\n')) {
    const a = /^\s*ARG\s+([A-Za-z_][A-Za-z0-9_]*)=(\S+)/i.exec(line)
    if (a) args.set(a[1]!, a[2]!.replace(/^["']|["']$/g, ''))
    const m = /^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/i.exec(line)
    if (!m) continue
    const ref = m[1]!
    if (!/playwright|e2e-base/i.test(ref)) continue
    const resolved = ref.replace(
      /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
      (s, b, p) => args.get((b ?? p) as string) ?? s
    )
    const v = /:v?(\d+\.\d+\.\d+)(?:-|$)/.exec(resolved)
    out.push({ file, ref, version: v?.[1] })
  }
  return out
}

interface DependabotDoc {
  updates?: {
    'package-ecosystem'?: string
    directory?: string
    ignore?: { 'dependency-name'?: string; 'update-types'?: string[] }[]
  }[]
}

/** The hold on the npm entry for `directory`, the package root as Dependabot names it. */
export function holdOf(doc: DependabotDoc, directory = '/code'): PinInputs['hold'] {
  const entry = (doc.updates ?? []).find(
    u => u['package-ecosystem'] === 'npm' && u.directory === directory
  )
  const rule = entry?.ignore?.find(r => r['dependency-name'] === PKG)
  return rule
    ? { present: true, updateTypes: rule['update-types'], directory }
    : { present: false, directory }
}

function readInputs(): PinInputs {
  const pkg = JSON.parse(readFileSync(join(CODE, 'package.json'), 'utf-8')) as {
    devDependencies?: Record<string, string>
    dependencies?: Record<string, string>
  }
  const lock = JSON.parse(readFileSync(join(CODE, 'package-lock.json'), 'utf-8')) as {
    packages?: Record<string, { version?: string }>
  }
  const images = readdirSync(DOCKER_CONFIG)
    .filter(f => /^Dockerfile/.test(f))
    .sort()
    .flatMap(f =>
      playwrightImages(
        `testing/e2e-docker/config/${f}`,
        readFileSync(join(DOCKER_CONFIG, f), 'utf-8')
      )
    )
  const dependabot = load(
    readFileSync(join(REPO, '.github', 'dependabot.yml'), 'utf-8')
  ) as DependabotDoc
  return {
    spec: pkg.devDependencies?.[PKG] ?? pkg.dependencies?.[PKG],
    locked: Object.fromEntries(LOCKED.map(n => [n, lock.packages?.[`node_modules/${n}`]?.version])),
    images,
    hold: holdOf(dependabot, CODE_DIR)
  }
}

// ---------------------------------------------------------------------------
// Corpus
// ---------------------------------------------------------------------------

const GOOD: PinInputs = {
  spec: '1.58.2',
  locked: { '@playwright/test': '1.58.2', playwright: '1.58.2', 'playwright-core': '1.58.2' },
  images: [
    { file: 'Dockerfile', ref: 'mcr.microsoft.com/playwright:v1.58.2-jammy', version: '1.58.2' },
    { file: 'Dockerfile.airgap', ref: 'app-e2e-base:v1.58.2-jammy', version: '1.58.2' }
  ],
  hold: { present: true }
}
const with_ = (patch: (i: PinInputs) => void): PinInputs => {
  const i = JSON.parse(JSON.stringify(GOOD)) as PinInputs
  patch(i)
  return i
}

const CATCH: [string, PinInputs, RegExp][] = [
  [
    'the 2026-09-16 incident: client 1.63.0 against 1.58.2 images',
    with_(i => {
      i.spec = '1.63.0'
      i.locked = { '@playwright/test': '1.63.0', playwright: '1.63.0', 'playwright-core': '1.63.0' }
    }),
    /Dockerfile builds FROM .*1\.58\.2, not 1\.63\.0/
  ],
  ['a range instead of an exact version', with_(i => (i.spec = '^1.58.2')), /exact version/],
  [
    'a lockfile that moved on its own',
    with_(i => (i.locked['playwright-core'] = '1.59.0')),
    /playwright-core to 1\.59\.0/
  ],
  ['no Playwright image at all', with_(i => (i.images = [])), /no Playwright image/],
  [
    'an image tag with no version in it',
    with_(i => (i.images[0]!.version = undefined)),
    /no version in the tag/
  ],
  ['no Dependabot hold', with_(i => (i.hold = { present: false })), /does not hold/],
  [
    'a hold on majors only — what let the 2026-09-16 bump through',
    with_(i => (i.hold = { present: true, updateTypes: ['version-update:semver-major'] })),
    /every update type/
  ],
  [
    'the package not declared — this repository until 2026-11-10',
    with_(i => (i.spec = undefined)),
    /not declared/
  ]
]

const IGNORE: [string, PinInputs][] = [
  ['everything at one version, held at every update type', GOOD],
  ['a single image', with_(i => (i.images = i.images.slice(0, 1)))]
]

const PARSE_CATCH: [string, string, string | undefined][] = [
  ['the runner image', 'FROM mcr.microsoft.com/playwright:v1.58.2-jammy', '1.58.2'],
  ['a pre-built base image', 'FROM app-e2e-base:v1.58.2-jammy AS base', '1.58.2'],
  [
    'a platform flag',
    'FROM --platform=linux/amd64 mcr.microsoft.com/playwright:v1.60.0-noble',
    '1.60.0'
  ],
  ['a tag without a version', 'FROM mcr.microsoft.com/playwright:latest', undefined],
  [
    "an ARG's default in the tag, as a base image writes it",
    'ARG PLAYWRIGHT_VERSION=1.58.2\nFROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy',
    '1.58.2'
  ],
  [
    'an ARG in its $NAME form',
    'ARG V=1.60.0\nFROM mcr.microsoft.com/playwright:v$V-jammy',
    '1.60.0'
  ],
  [
    'an ARG with no default leaves the tag without a version',
    'ARG PLAYWRIGHT_VERSION\nFROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy',
    undefined
  ]
]
const PARSE_IGNORE: [string, string][] = [
  ['a non-Playwright base image', 'FROM node:24-bookworm'],
  ['a comment naming the image', '# FROM mcr.microsoft.com/playwright:v1.0.0-jammy']
]

function selfTest(): { ok: boolean; catches: number; ignores: number } {
  let ok = true
  const say = (good: boolean, what: string, why = '') => {
    if (!good) ok = false
    console.log(`  ${good ? `${DIM}ok  ` : `${RED}FAIL`} ${what}${why ? ` — ${why}` : ''}${OFF}`)
  }
  for (const [name, input, want] of CATCH) {
    const f = pinFindings(input)
    say(
      f.some(x => want.test(x)),
      `CATCH  ${name}`,
      f.some(x => want.test(x)) ? '' : `got: ${f.join(' | ') || '(nothing)'}`
    )
  }
  for (const [name, input] of IGNORE) {
    const f = pinFindings(input)
    say(f.length === 0, `IGNORE ${name}`, f.join(' | '))
  }
  for (const [name, line, want] of PARSE_CATCH) {
    const got = playwrightImages('Dockerfile', line)
    say(
      got.length === 1 && got[0]!.version === want,
      `CATCH  FROM parse: ${name}`,
      JSON.stringify(got)
    )
  }
  for (const [name, line] of PARSE_IGNORE) {
    const got = playwrightImages('Dockerfile', line)
    say(got.length === 0, `IGNORE FROM parse: ${name}`, JSON.stringify(got))
  }
  const holdCases: [string, DependabotDoc, string, boolean][] = [
    [
      'a hold on the /code entry',
      {
        updates: [
          { 'package-ecosystem': 'npm', directory: '/code', ignore: [{ 'dependency-name': PKG }] }
        ]
      },
      '/code',
      true
    ],
    [
      'a hold on ANOTHER entry does not count',
      {
        updates: [
          {
            'package-ecosystem': 'npm',
            directory: '/code/codebase-mcp',
            ignore: [{ 'dependency-name': PKG }]
          }
        ]
      },
      '/code',
      false
    ],
    [
      'a deeper package root reads its own entry',
      {
        updates: [
          {
            'package-ecosystem': 'npm',
            directory: '/code/App',
            ignore: [{ 'dependency-name': PKG }]
          }
        ]
      },
      '/code/App',
      true
    ],
    [
      "a deeper package root does not borrow /code's hold",
      {
        updates: [
          { 'package-ecosystem': 'npm', directory: '/code', ignore: [{ 'dependency-name': PKG }] }
        ]
      },
      '/code/App',
      false
    ]
  ]
  for (const [name, doc, directory, present] of holdCases) {
    say(
      holdOf(doc, directory).present === present,
      `${present ? 'IGNORE' : 'CATCH '} dependabot: ${name}`
    )
  }
  return {
    ok,
    catches: CATCH.length + PARSE_CATCH.length + holdCases.filter(c => !c[3]).length,
    ignores: IGNORE.length + PARSE_IGNORE.length + holdCases.filter(c => c[3]).length
  }
}

function main(): void {
  console.log(
    `\n${BOLD}Playwright pin${OFF} ${DIM}— the client and its images are one version${OFF}\n`
  )
  const st = selfTest()
  console.log(`  auditor-contract: catch=${st.catches} ignore=${st.ignores}`)
  if (!st.ok) {
    console.log(
      `\n${RED}${BOLD}RESULT: FAIL${OFF} — the corpus failed, so the repository was not checked.`
    )
    process.exit(1)
  }
  if (process.argv.includes('--self-test')) {
    console.log(`\n${GRN}${BOLD}self-test PASS${OFF} — corpus only`)
    return
  }
  const inputs = readInputs()
  console.log(
    `  ${DIM}${PKG} ${inputs.spec ?? '(undeclared)'} · ${inputs.images.length} image(s): ` +
      `${inputs.images.map(i => i.ref).join(', ') || '(none)'}${OFF}`
  )
  const findings = pinFindings(inputs)
  if (findings.length > 0) {
    for (const f of findings) console.log(`  ${RED}✗${OFF} ${f}`)
    console.log(
      `\n${RED}${BOLD}RESULT: FAIL${OFF} — move ${PKG} and the images together: ` +
        'the Dockerfile FROM tags here, and any browser pinned outside this repository.'
    )
    process.exit(1)
  }
  console.log(
    `\n${GRN}${BOLD}RESULT: PASS${OFF} — client, lockfile and images agree, and Dependabot holds the version`
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
