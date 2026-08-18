#!/usr/bin/env node
// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * provision:ownership / audit:ownership — every file in the working tree belongs to the person
 * working in it, and the containers that write there run as that person.
 *
 * WHY THIS EXISTS
 * ---------------
 * The E2E harness bind-mounts the whole repo at /app. A container running as root therefore writes
 * ROOT-OWNED files into the developer's working tree — and not into a corner of it: measured in
 * this template on 2026-08-18, 28 paths across `.quasar/dev-spa`, `node_modules/.q-cache`,
 * `logs/`, `playwright-report/`, `test-results/` and `testing/e2e-docker/output/`.
 *
 * The symptom is not a permissions message anyone reads as one. It is:
 *
 *     Error: EACCES: permission denied, open '.../.quasar/dev-spa/app.js'
 *
 * out of `quasar dev`, on a repo that was working yesterday, with no local change that explains
 * it. The dev server simply stops starting, and clearing it needs sudo.
 *
 * This is a SCAFFOLD file, which is the whole reason it is worth automating rather than
 * remembering. A template is the base every project's dev server is generated FROM, so a harness
 * defect here is not one repo's problem — it is inherited by every project ever generated, and
 * each one rediscovers it separately.
 *
 * THE TWO HALVES, AND WHY BOTH ARE NEEDED
 * ---------------------------------------
 *   PREVENT  — every compose service declares a non-root `user:`, and the runner scripts export
 *              the uid variable that `user:` reads. This is the root-cause fix; without it the
 *              other half is a mop.
 *   RECLAIM  — chown anything an earlier root run already left behind. Needed because the fix is
 *              NOT retroactive: a non-root container still cannot write into a directory a root
 *              container created, so the first run after the fix fails deep inside the suite and
 *              reads as a test failure rather than as a leftover.
 *
 * WHY IT READS THE COMPOSE SOURCE AND NOT `docker compose config`
 * ---------------------------------------------------------------
 * The resolved config is the tempting input — it expands anchors for you. It also hides five of
 * this file's six services behind `profiles:`, so a checker that enumerates it without
 * `--profile "*"` sees ONE service, finds it correct, and reports a green tick for a harness that
 * is five-sixths broken. Reading the source asks the question the invariant is actually about
 * ("does every service declare a user?"), needs no docker, and can be self-tested offline.
 *
 * NEVER DELETES ANYTHING. It changes ownership and nothing else — a provisioning script that
 * removes files is one nobody can safely run twice.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COMPOSE = join(APP_DIR, 'testing/e2e-docker/docker-compose.yml')
const RUNNER_DIR = join(APP_DIR, 'testing/e2e-docker/scripts')

// ── Compose parsing ───────────────────────────────────────────────────────────────────────────

/**
 * Strip full-line and trailing `#` comments, preserving quoted `#`.
 *
 * Prose is not configuration. A comment reading "every service sets `user:`" must not be read as
 * a service setting `user:` — the same trap that let an auditor be inducted into a compliance
 * universe by a name-drop in a code comment.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripYamlComments(text) {
  return text
    .split('\n')
    .map((line) => {
      let out = ''
      let quote = null
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (quote) {
          if (c === quote) quote = null
          out += c
          continue
        }
        if (c === '"' || c === "'") {
          quote = c
          out += c
          continue
        }
        if (c === '#') break
        out += c
      }
      return out.trimEnd()
    })
    .join('\n')
}

/** A `user:` value that is root, or empty, is not a fix. */
function isRootUser(value) {
  const v = value.trim().replace(/^["']|["']$/g, '')
  if (v === '') return true
  const uid = v.split(':')[0]
  return uid === '0' || uid === 'root'
}

/**
 * Read the compose SOURCE and report, per service, whether it must run as the invoking user and
 * whether it does.
 *
 * SCOPE — only services that BIND-MOUNT A HOST PATH are in scope. The invariant is "a container
 * that writes into the working tree runs as the person who owns it", and a service with no host
 * mount is structurally incapable of breaking it. Demanding `user:` there would flag correct
 * configuration, and a rule that flags correct configuration gets switched off, after which it
 * catches nothing at all. Weaver's `playwright-browser` is the live case: a stock Playwright
 * image with no volumes, which cannot touch the tree however it runs.
 *
 * EXEMPTION — a service that genuinely needs root declares it in the compose file:
 *
 *     # ownership-exempt: <why>
 *
 * The reason is REQUIRED; a bare marker is still reported, the same way `sast-ignore[rule-id]`
 * will not match without one. The live case is Weaver's `playwright-apptainer`, which is
 * `privileged: true` because Apptainer's setuid workflow needs it.
 *
 * @param {string} rawText
 * @returns {{services: Array<{name: string, inScope: boolean, ok: boolean, why: string}>, uidVars: string[]}}
 */
export function parseComposeUsers(rawText) {
  const raw = rawText.split('\n')
  const lines = stripYamlComments(rawText).split('\n')

  const userAnchors = new Set()
  const uidVars = new Set()

  const collectVars = (value) => {
    for (const m of value.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-[^}]*)?\}/g)) uidVars.add(m[1])
  }

  for (let i = 0; i < lines.length; i++) {
    const anchor = lines[i].match(/^[a-zA-Z0-9_-]+:\s*&([A-Za-z0-9_-]+)\s*$/)
    if (!anchor) continue
    for (let j = i + 1; j < lines.length && /^\s|^$/.test(lines[j]); j++) {
      const u = lines[j].match(/^\s+user:\s*(.+)$/)
      if (u && !isRootUser(u[1])) {
        userAnchors.add(anchor[1])
        collectVars(u[1])
      }
    }
  }

  const servicesAt = lines.findIndex((l) => /^services:\s*$/.test(l))
  const services = []
  if (servicesAt === -1) return { services, uidVars: [...uidVars] }

  let current = null
  let inVolumes = false
  const finish = () => {
    if (current) services.push(current)
    current = null
  }

  for (let i = servicesAt + 1; i < lines.length; i++) {
    const line = lines[i]

    if (/^\S/.test(line) && line.trim() !== '') {
      finish()
      break
    }

    const head = line.match(/^ {2}([A-Za-z0-9_.-]+):\s*$/)
    if (head) {
      finish()
      inVolumes = false
      current = {
        name: head[1],
        inScope: false,
        hasUser: false,
        exempt: null,
        bareExempt: false,
        ok: false,
        why: '',
      }
      continue
    }
    if (!current) continue

    // The exemption marker is a COMMENT, so it has to be read off the raw line — the stripped
    // copy no longer contains it.
    const marker = (raw[i] ?? '').match(/#\s*ownership-exempt\b:?\s*(.*)$/)
    if (marker) {
      const reason = marker[1].trim()
      if (reason) current.exempt = reason
      else current.bareExempt = true
    }

    if (/^ {4}volumes:\s*$/.test(line)) { inVolumes = true; continue }
    if (/^ {4}[A-Za-z0-9_.-]+:/.test(line)) inVolumes = false

    // A host bind is `- <host path>:<container path>`. A named volume has no path-looking left
    // side, and does not put the working tree inside the container.
    if (inVolumes) {
      const vol = line.match(/^ {6}-\s*(.+)$/)
      if (vol && /^[.~/]/.test(vol[1].trim())) current.inScope = true
    }

    const merge = line.match(/^\s+<<:\s*\*([A-Za-z0-9_-]+)\s*$/)
    if (merge && userAnchors.has(merge[1])) {
      current.hasUser = true
      current.why = `merges anchor *${merge[1]}`
      continue
    }

    const direct = line.match(/^ {4}user:\s*(.+)$/)
    if (direct) {
      if (isRootUser(direct[1])) {
        current.hasUser = false
        current.why = `declares \`user: ${direct[1].trim()}\`, which is root`
      } else {
        current.hasUser = true
        current.why = 'declares `user:` directly'
        collectVars(direct[1])
      }
    }
  }
  finish()

  for (const svc of services) {
    if (svc.bareExempt && !svc.exempt) {
      svc.ok = false
      svc.why = 'carries a bare `# ownership-exempt` with no reason — state why root is required'
      continue
    }
    if (!svc.inScope) {
      svc.ok = true
      svc.why = svc.why || 'no host bind mount — cannot write into the working tree'
      continue
    }
    if (svc.exempt) {
      svc.ok = true
      svc.why = `exempt: ${svc.exempt}`
      continue
    }
    svc.ok = svc.hasUser
    if (!svc.ok && !svc.why) svc.why = 'bind-mounts the repo but declares no `user:`'
  }

  return { services, uidVars: [...uidVars] }
}

/**
 * Every script that DRIVES docker compose must put the uid into the environment — by exporting it
 * itself, or by sourcing a file that does.
 *
 * "At least one runner exports it" is the weaker question, and it is the one this check asked
 * first. It passes as soon as a single script is correct, which is exactly the state Weaver was
 * in: one of fifteen runners sourced the helper and the other fourteen silently used
 * `${E2E_UID:-1000}`. That default is 1000, which is the developer's uid on this machine — so the
 * hole was invisible here and would surface as root-owned files on any host where it is not.
 *
 * Shell comments are stripped before deciding scope, so a script that merely MENTIONS docker
 * compose in prose is not treated as one that runs it.
 *
 * @param {Array<{name: string, text: string}>} files
 * @param {string[]} uidVars
 * @returns {string[]} names of compose-driving scripts that leave the uid unset
 */
export function findRunnersMissingUid(files, uidVars) {
  if (uidVars.length === 0) return []

  const stripShellComments = (text) =>
    text
      .split('\n')
      .map((l) => l.replace(/(^|\s)#.*$/, '$1'))
      .join('\n')

  const exportsUid = (text) => uidVars.every((v) => new RegExp(`export\\s+${v}=`).test(text))
  const providers = new Set(files.filter((f) => exportsUid(f.text)).map((f) => f.name))

  // Escaping is an explicit helper rather than an inline .replace with '$&': in a replacement
  // STRING, `$&` means "the matched text", so writing it that way is one careless copy away from
  // silently substituting something else. A function replacer has no special sequences at all.
  const escapeForRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, (ch) => '\\' + ch)

  const missing = []
  for (const f of files) {
    const code = stripShellComments(f.text)
    if (!/docker[ -]compose/.test(code)) continue
    if (exportsUid(f.text)) continue
    const sourced = [...providers].some((p) =>
      new RegExp(`(^|\\s)(\\.|source)\\s+[^\\n]*${escapeForRegExp(p)}`).test(code)
    )
    if (!sourced) missing.push(f.name)
  }
  return missing
}

// ── Ownership ─────────────────────────────────────────────────────────────────────────────────

/**
 * Paths under `root` not owned by `uid`.
 *
 * Shells out to `find` because the tree includes node_modules — hundreds of thousands of entries,
 * where a JS recursion is seconds and a single syscall-bound `find` is milliseconds. `-xdev` keeps
 * it on one filesystem so a mounted volume is never touched.
 *
 * GROUP is deliberately not checked. On this fleet the login group is `users` while many files are
 * created under other group memberships, all of them writable by the owner — flagging that would
 * report hundreds of correct files and get the check switched off.
 *
 * @param {string} root
 * @param {number} uid
 * @returns {string[]}
 */
export function findForeignOwned(root, uid) {
  const r = spawnSync('find', [root, '-xdev', '!', '-uid', String(uid), '-print0'], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })
  // find exits non-zero on unreadable subtrees while still printing what it did read; the output
  // is what matters, so status is not treated as fatal.
  return (r.stdout || '').split('\0').filter(Boolean)
}

/** Roll the paths up to their shallowest common ancestors, so chown -R does the work once. */
export function topmostPaths(paths) {
  const sorted = [...paths].sort()
  const out = []
  for (const p of sorted) {
    if (!out.some((prefix) => p === prefix || p.startsWith(prefix + '/'))) out.push(p)
  }
  return out
}

function chownBinary() {
  // The path a sudoers allowlist can name. `command -v chown` resolves through the NixOS symlink
  // to /nix/store/<hash>/bin/chown — a different string from the allowlisted one, and one that
  // changes on every coreutils bump.
  return existsSync('/run/current-system/sw/bin/chown')
    ? '/run/current-system/sw/bin/chown'
    : 'chown'
}

// ── Self-test ─────────────────────────────────────────────────────────────────────────────────

// A service is in scope only if it BIND-MOUNTS a host path, so every in-scope case carries one.
const BIND = '    volumes:\n      - ../..:/app\n'
const ANCHOR = 'x-host-user: &host-user\n  user: "${HOST_UID:-1000}:${HOST_GID:-1000}"\n\n'

const COMPOSE_CATCH = [
  ['a bind-mounting service with no user at all', 'services:\n  a:\n' + BIND + '    image: x\n'],
  [
    'a bind-mounting service merging an anchor that declares no user',
    'x-common: &common\n  shm_size: 2g\n\nservices:\n  a:\n    <<: *common\n' + BIND,
  ],
  ['an explicit root user', 'services:\n  a:\n    user: "0:0"\n' + BIND],
  ['user: root by name', 'services:\n  a:\n    user: root\n' + BIND],
  ['an empty user value', 'services:\n  a:\n    user: ""\n' + BIND],
  ['an anchor that is defined but never merged', ANCHOR + 'services:\n  a:\n' + BIND],
  [
    'a COMMENT claiming a user is set, over a service that does not',
    'services:\n  a:\n    # user: "${HOST_UID}:${HOST_GID}" — every service sets this\n' + BIND,
  ],
  [
    'one good service and one bad one',
    ANCHOR + 'services:\n  a:\n    <<: *host-user\n' + BIND + '  b:\n' + BIND,
  ],
  [
    'a BARE ownership-exempt with no reason is not an exemption',
    'services:\n  a:\n    # ownership-exempt\n' + BIND,
  ],
]

const COMPOSE_IGNORE = [
  [
    'anchor merged into every service',
    ANCHOR + 'services:\n  a:\n    <<: *host-user\n' + BIND + '  b:\n    <<: *host-user\n' + BIND,
  ],
  [
    'per-service user, no anchor',
    'services:\n  a:\n    user: "${HOST_UID:-1000}:${HOST_GID:-1000}"\n' + BIND,
  ],
  ['a literal non-root uid', 'services:\n  a:\n    user: "1000:1000"\n' + BIND],
  [
    'profiles do not hide a service from a source-level read',
    ANCHOR + 'services:\n  a:\n    <<: *host-user\n    profiles:\n      - ui\n' + BIND,
  ],
  [
    'a second anchor without a user does not cancel the one with it',
    'x-log: &log\n  driver: json-file\n' + ANCHOR + 'services:\n  a:\n    <<: *host-user\n' + BIND,
  ],
  [
    'a # inside a quoted value is data, not a comment',
    ANCHOR + 'services:\n  a:\n    <<: *host-user\n    command: "echo #1"\n' + BIND,
  ],
  [
    'a nested key called user deeper in the service is not the service user',
    ANCHOR + 'services:\n  a:\n    <<: *host-user\n' + BIND + '    environment:\n      user: someone\n',
  ],
  [
    'a service with NO volumes cannot write to the tree, so it needs no user',
    'services:\n  a:\n    image: mcr.microsoft.com/playwright\n    command: chrome\n',
  ],
  [
    'a NAMED volume is not a host bind and does not put the tree in the container',
    'services:\n  a:\n    volumes:\n      - cache:/root/.cache\n    image: x\n',
  ],
  [
    'an ownership-exempt WITH a reason is honoured',
    'services:\n  a:\n    # ownership-exempt: privileged for Apptainer setuid\n    privileged: true\n' + BIND,
  ],
]

// Runner-leg corpus. `files` is [{name, text}]; the check reports compose-driving scripts that
// leave the uid unset.
const HELPER = { name: 'host-user.sh', text: 'export HOST_UID="$(id -u)"\nexport HOST_GID="$(id -g)"\n' }
const UID_VARS = ['HOST_UID', 'HOST_GID']

const RUNNER_CATCH = [
  [
    'a compose-driving script that neither exports nor sources',
    [HELPER, { name: 'run-ui.sh', text: 'set -e\ndocker compose --profile ui up --build\n' }],
  ],
  [
    'a script that sources a file which does NOT export the uid',
    [
      HELPER,
      { name: 'common.sh', text: 'echo hello\n' },
      { name: 'run-x.sh', text: '. "$SCRIPT_DIR/lib/common.sh"\ndocker compose up\n' },
    ],
  ],
  [
    'one correct runner does not excuse a second incorrect one',
    [
      HELPER,
      { name: 'run-tests.sh', text: 'source "$SCRIPT_DIR/lib/host-user.sh"\ndocker compose up\n' },
      { name: 'run-single.sh', text: 'docker compose --profile single up\n' },
    ],
  ],
  [
    'the legacy docker-compose spelling is still driving compose',
    [HELPER, { name: 'old.sh', text: 'docker-compose up --build\n' }],
  ],
  [
    'exporting only ONE of the two uid variables is not enough',
    [
      { name: 'half.sh', text: 'export HOST_UID="$(id -u)"\ndocker compose up\n' },
    ],
  ],
]

const RUNNER_IGNORE = [
  [
    'a runner that sources the helper',
    [HELPER, { name: 'run-tests.sh', text: 'source "$SCRIPT_DIR/lib/host-user.sh"\ndocker compose up\n' }],
  ],
  [
    'a runner that sources with the dot form',
    [HELPER, { name: 'run-tests.sh', text: '. "$SCRIPT_DIR/lib/host-user.sh"\ndocker compose up\n' }],
  ],
  [
    'a runner that exports the uid itself',
    [{ name: 'solo.sh', text: 'export HOST_UID="$(id -u)"\nexport HOST_GID="$(id -g)"\ndocker compose up\n' }],
  ],
  [
    'a script that never drives compose is out of scope',
    [HELPER, { name: 'analyze.sh', text: 'set -e\nnode analyze-results.mjs\n' }],
  ],
  [
    'a script that only MENTIONS docker compose in a comment is out of scope',
    [HELPER, { name: 'notes.sh', text: '# this used to call docker compose up\nnode x.mjs\n' }],
  ],
  [
    'the helper itself is not a runner',
    [HELPER],
  ],
]

function selfTest() {
  const failures = []

  for (const [name, yaml] of COMPOSE_CATCH) {
    const { services } = parseComposeUsers(yaml)
    const bad = services.filter((s) => !s.ok)
    if (bad.length === 0) failures.push(`CATCH missed: ${name}`)
  }

  for (const [name, yaml] of COMPOSE_IGNORE) {
    const { services } = parseComposeUsers(yaml)
    const bad = services.filter((s) => !s.ok)
    if (services.length === 0) failures.push(`IGNORE parsed no services at all: ${name}`)
    else if (bad.length > 0) failures.push(`IGNORE wrongly flagged: ${name} — ${bad.map((s) => `${s.name}: ${s.why}`).join('; ')}`)
  }

  // The uid variable must be RECOVERED from the compose text, not assumed — Weaver's harness calls
  // it E2E_UID and Gantry's HOST_UID, and a checker that hardcoded either would be wrong somewhere.
  const { uidVars } = parseComposeUsers(
    'x-host-user: &host-user\n  user: "${E2E_UID:-1000}:${E2E_GID:-1000}"\n\nservices:\n  a:\n    <<: *host-user\n'
  )
  if (!uidVars.includes('E2E_UID') || !uidVars.includes('E2E_GID')) {
    failures.push(`uid variables not recovered from the compose expression (got ${uidVars.join(', ') || 'none'})`)
  }

  // The ownership finder, both directions, without needing root: an impossible uid must make every
  // file foreign, and the real uid must make none of them foreign.
  const probe = APP_DIR
  const nobodyFinds = findForeignOwned(probe, 2147483646)
  if (nobodyFinds.length === 0) failures.push('ownership finder reported nothing for an impossible uid — it cannot see files')
  const selfFinds = findForeignOwned(probe, process.getuid())
  if (selfFinds.length > 0 && selfFinds.length === nobodyFinds.length) {
    failures.push('ownership finder ignores the uid argument — same result for self and for nobody')
  }

  if (topmostPaths(['/a/b', '/a', '/a/b/c', '/d']).join(',') !== '/a,/d') {
    failures.push('topmostPaths did not collapse nested paths')
  }

  for (const [name, files] of RUNNER_CATCH) {
    if (findRunnersMissingUid(files, UID_VARS).length === 0) failures.push(`CATCH missed (runner): ${name}`)
  }
  for (const [name, files] of RUNNER_IGNORE) {
    const flagged = findRunnersMissingUid(files, UID_VARS)
    if (flagged.length > 0) failures.push(`IGNORE wrongly flagged (runner): ${name} — ${flagged.join(', ')}`)
  }

  for (const f of failures) console.error(`  ✗ ${f}`)
  console.log(
    `auditor-contract: catch=${COMPOSE_CATCH.length + RUNNER_CATCH.length} ` +
      `ignore=${COMPOSE_IGNORE.length + RUNNER_IGNORE.length}`
  )
  return failures.length === 0
}

// ── Main ──────────────────────────────────────────────────────────────────────────────────────

function usage() {
  console.log(`provision-ownership — keep the working tree owned by the person working in it

  node scripts/provision-ownership.js             provision: verify prevention, reclaim leftovers
  node scripts/provision-ownership.js --check     report only, exit 1 on findings (CI / audit)
  node scripts/provision-ownership.js --self-test prove the checks can fail
  node scripts/provision-ownership.js --help

Never deletes anything; it changes ownership only.`)
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) return usage()

  const selfTestOnly = argv.includes('--self-test')
  const checkOnly = argv.includes('--check')

  console.log('provision:ownership — working-tree ownership and the harness that writes to it')

  if (!selfTest()) {
    console.error('\n✗ corpus FAILED — refusing to report or mutate; the checker is not trustworthy')
    process.exit(1)
  }
  if (selfTestOnly) {
    console.log('✓ self-test passed')
    return
  }

  // Refuse to operate anywhere that is not this repository's working tree. A provisioning script
  // that chowns is one bad path away from being a very bad day.
  let worktree
  try {
    worktree = execFileSync('git', ['-C', APP_DIR, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf-8',
    }).trim()
  } catch {
    console.error(`\n✗ ${APP_DIR} is not inside a git worktree — refusing to touch ownership here.`)
    process.exit(1)
  }
  if (!APP_DIR.startsWith(worktree)) {
    console.error(`\n✗ ${APP_DIR} resolves outside its own worktree (${worktree}) — refusing.`)
    process.exit(1)
  }

  const problems = []
  const uid = process.getuid()
  const gid = process.getgid()

  // ── PREVENT ─────────────────────────────────────────────────────────────────────────────────
  if (!existsSync(COMPOSE)) {
    console.log('  no testing/e2e-docker/docker-compose.yml — no container writes to guard')
  } else {
    const { services, uidVars } = parseComposeUsers(readFileSync(COMPOSE, 'utf-8'))
    const bad = services.filter((s) => !s.ok)

    if (services.length === 0) {
      problems.push('docker-compose.yml parsed to zero services — the check cannot see anything')
    }
    for (const s of bad) {
      problems.push(`compose service \`${s.name}\`: ${s.why} — it will write root-owned files into the working tree`)
    }

    // A `user:` reading ${HOST_UID} is only a fix if something exports HOST_UID. The variable name
    // is recovered from the compose file rather than assumed, so this works unchanged in a repo
    // that named it E2E_UID.
    const runnerFiles = existsSync(RUNNER_DIR)
      ? readdirSync(RUNNER_DIR, { recursive: true })
          .map((f) => String(f))
          .filter((f) => statSync(join(RUNNER_DIR, f)).isFile())
          .map((f) => ({ name: f.split('/').pop(), text: readFileSync(join(RUNNER_DIR, f), 'utf-8') }))
      : []
    const missing = findRunnersMissingUid(runnerFiles, uidVars)
    for (const name of missing) {
      problems.push(
        `${name} drives docker compose but never puts ${uidVars.join('/')} in the environment — ` +
          `compose falls back to its default uid, silently, on every run`
      )
    }

    console.log(
      `  ${services.length} compose service(s) · ${services.length - bad.length} run as the invoking user · ` +
        `uid from ${uidVars.join(', ') || '(literal)'}`
    )
  }

  // ── RECLAIM ─────────────────────────────────────────────────────────────────────────────────
  const foreign = findForeignOwned(worktree, uid)
  const roots = topmostPaths(foreign)

  if (foreign.length === 0) {
    console.log(`  every path under ${worktree} is owned by uid ${uid}`)
  } else if (checkOnly) {
    problems.push(
      `${foreign.length} path(s) under ${worktree} are not owned by uid ${uid} — run: npm run provision:ownership`
    )
    for (const p of roots.slice(0, 10)) console.error(`      ${p}`)
  } else {
    console.log(`  reclaiming ${foreign.length} path(s) in ${roots.length} subtree(s):`)
    const bin = chownBinary()
    for (const p of roots) console.log(`      ${p}`)
    const r = spawnSync('sudo', ['-n', bin, '-R', `${uid}:${gid}`, ...roots], { stdio: 'inherit' })
    if (r.status !== 0) {
      console.error(`\n✗ could not reclaim ownership without an interactive sudo. Run:`)
      console.error(`    sudo ${bin} -R ${uid}:${gid} \\\n      ${roots.join(' \\\n      ')}`)
      process.exit(1)
    }
    const left = findForeignOwned(worktree, uid)
    if (left.length > 0) {
      problems.push(`${left.length} path(s) still not owned by uid ${uid} after chown`)
    } else {
      console.log('  ✓ reclaimed')
    }
  }

  if (problems.length > 0) {
    console.error('')
    for (const p of problems) console.error(`  ✗ ${p}`)
    console.error(`\n✗ ${checkOnly ? 'audit:ownership' : 'provision:ownership'} FAILED (${problems.length})`)
    process.exit(1)
  }

  console.log(`✓ ${checkOnly ? 'audit:ownership' : 'provision:ownership'} passed`)
}

main()
