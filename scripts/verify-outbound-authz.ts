// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:outbound-authz — only the ACL-aware client map may send to a WebSocket.
 *
 * The per-VM ACL was enforced on every request path and on nothing that left. Four separate
 * fan-outs each made their own decision about who to send to, and only one got it right:
 * `routes/agent.ts` iterated `fastify.websocketServer.clients` — the raw `ws` set, which carries
 * no auth information at all — and sent the model's analysis of one workload (its context is
 * `journalLogs` and `systemctlStatus`) to every connected socket. On Fabrick that crossed a per-VM
 * ACL boundary the preHandler had just enforced on the request.
 *
 * The fix routed every outbound workload message through one `maySee()` decision in `routes/ws.ts`.
 * This auditor is what stops the next one going around it: `routes/ws.ts` owns the only client map
 * that knows who each socket belongs to, so it is the only file permitted to reach a raw socket
 * set. Anywhere else, emit an event and let that layer fan it out.
 *
 * **Comments are stripped before scanning, and that is the load-bearing detail.** After the fix the
 * only remaining mentions of `websocketServer.clients` in the codebase are two comments explaining
 * why you must not do it — so a grep-based version of this check reports its own documentation as
 * a violation. A checker that flags the fix's own explanation gets switched off, after which it
 * catches nothing at all.
 *
 * Usage:
 *   npx tsx scripts/verify-outbound-authz.ts
 *   npx tsx scripts/verify-outbound-authz.ts --self-test
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = resolve(HERE, '..')
const BACKEND_SRC = join(PKG, 'backend/src')

const RED = '\x1b[31m'; const GREEN = '\x1b[32m'; const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'; const RESET = '\x1b[0m'

/**
 * The one file permitted to touch a raw socket set. It holds the `clients` Map that carries each
 * socket's userId and role, and the `maySee()` predicate every outbound message goes through.
 */
const OWNER = 'backend/src/routes/ws.ts'

interface Rule { id: string; pattern: RegExp; why: string }

const RULES: Rule[] = [
  {
    id: 'raw-client-set',
    // Matches `websocketServer` at all, not `websocketServer.clients`. The narrower pattern was
    // the first draft and its own CATCH corpus killed it: `const s = fastify.websocketServer`
    // followed by `s.clients` defeats it entirely, and that is one rename away from being how the
    // next person writes it. There is no legitimate reason for a file other than the owner to
    // hold the socket server, so reaching for it at all is the thing to forbid.
    pattern: /\bwebsocketServer\b/,
    why: 'only routes/ws.ts may hold the socket server — the raw `ws` client set carries no auth information. Emit an event and let that layer fan it out under maySee()',
  },
  {
    id: 'unscoped-client-iteration',
    // `clients.keys()` drops the WsClientInfo the same Map carries. This is exactly how
    // broadcastNotification leaked security telemetry to every connected client.
    pattern: /\bclients\s*\.\s*keys\s*\(\s*\)/,
    why: 'iterating clients.keys() discards the per-socket auth info the Map carries — iterate the entries and consult maySee()',
  },
]

/**
 * Remove comments and string/template literals so a mention cannot be mistaken for a call.
 * Deliberately simple and character-wise rather than a parser: it only has to make "is this text
 * executable?" answerable, and a regex-based stripper mangles apostrophes inside block comments.
 */
export function stripNonCode(src: string): string {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]; const c2 = src[i + 1]
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++ }
      continue
    }
    if (c === '/' && c2 === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++ }
      out += '  '; i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += ' '; i++
      while (i < n) {
        if (src[i] === '\\') { out += '  '; i += 2; continue }
        if (src[i] === quote) { out += ' '; i++; break }
        out += src[i] === '\n' ? '\n' : ' '
        i++
      }
      continue
    }
    out += c; i++
  }
  return out
}

export interface Violation { file: string; line: number; rule: string; why: string; text: string }

export function scan(relPath: string, source: string): Violation[] {
  if (relPath === OWNER) return []
  const code = stripNonCode(source)
  const codeLines = code.split('\n')
  const rawLines = source.split('\n')
  const out: Violation[] = []
  for (const rule of RULES) {
    codeLines.forEach((line, idx) => {
      if (rule.pattern.test(line)) {
        out.push({
          file: relPath, line: idx + 1, rule: rule.id, why: rule.why,
          text: (rawLines[idx] ?? '').trim(),
        })
      }
    })
  }
  return out
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { walk(p, acc); continue }
    if (p.endsWith('.ts')) acc.push(p)
  }
  return acc
}

// --------------------------------------------------------------------------------------------
// Self-test. CATCH — must be reported. IGNORE — must not be.
// --------------------------------------------------------------------------------------------

const CATCH_CASES: [string, string, string][] = [
  ['the exact call the fix removed', 'backend/src/routes/agent.ts',
   `for (const c of fastify.websocketServer.clients) { c.send(x) }`],
  ['spaced out', 'backend/src/routes/x.ts',
   `const s = fastify . websocketServer . clients`],
  ['off a local binding', 'backend/src/routes/x.ts',
   `const server = fastify.websocketServer\nfor (const c of server.clients) {}`],
  ['clients.keys() outside the owner', 'backend/src/routes/x.ts',
   `for (const client of clients.keys()) { client.send(p) }`],
  ['after a comment that mentions it', 'backend/src/routes/x.ts',
   `// never use websocketServer.clients here\nfor (const c of fastify.websocketServer.clients) {}`],
]

const IGNORE_CASES: [string, string, string][] = [
  // The two that exist in the codebase right now — the fix's own explanation.
  ['a line comment explaining the ban', 'backend/src/routes/agent.ts',
   `// This used to iterate \`fastify.websocketServer.clients\` directly. That is the raw ws set.`],
  ['a block comment explaining the ban', 'backend/src/services/agent.ts',
   `/**\n * it iterated \`fastify.websocketServer.clients\` — the raw ws set, which holds no auth info\n */`],
  ['the string in a thrown message', 'backend/src/routes/x.ts',
   `throw new Error('do not use websocketServer.clients')`],
  ['the owner file itself', OWNER,
   `for (const client of clients.keys()) { client.send(payload) }`],
  ['the owner using the raw set', OWNER,
   `const all = fastify.websocketServer.clients`],
  ['an ACL-aware iteration elsewhere', 'backend/src/routes/x.ts',
   `for (const [client, info] of clients) { if (maySee(info, name)) client.send(p) }`],
  ['an unrelated .clients on another object', 'backend/src/routes/x.ts',
   `const n = pool.clients.length`],
]

function selfTest(): boolean {
  const failures: string[] = []
  for (const [name, file, src] of CATCH_CASES) {
    if (scan(file, src).length === 0) failures.push(`CATCH missed: ${name}`)
  }
  for (const [name, file, src] of IGNORE_CASES) {
    const hits = scan(file, src)
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

  console.log(`${BOLD}Outbound Authorization${RESET}`)
  console.log(`${DIM}only routes/ws.ts may reach a raw socket set — every other sender emits${RESET}\n`)

  if (!selfTest()) {
    console.error(`\n${RED}${BOLD}RESULT: FAIL${RESET} — refusing to scan on a failed self-test`)
    process.exit(1)
  }
  if (selfTestOnly) {
    console.log(`\n${GREEN}${BOLD}SELF-TEST PASSED${RESET}`)
    return
  }

  const files = walk(BACKEND_SRC)
  const violations: Violation[] = []
  for (const abs of files) {
    const rel = relative(PKG, abs)
    violations.push(...scan(rel, readFileSync(abs, 'utf-8')))
  }

  console.log(`${DIM}  ${files.length} backend file(s) scanned · owner: ${OWNER}${RESET}`)

  if (violations.length > 0) {
    console.error('')
    for (const v of violations) {
      console.error(`  ${RED}✗${RESET} ${v.file}:${v.line} [${BOLD}${v.rule}${RESET}] — ${v.why}`)
      console.error(`      ${DIM}${v.text}${RESET}`)
    }
    console.error(`\n${RED}${BOLD}RESULT: FAIL${RESET} — ${violations.length} outbound send(s) bypassing the ACL-aware client map`)
    process.exit(1)
  }

  console.log(`\n${GREEN}${BOLD}RESULT: PASS${RESET} — every outbound WebSocket send goes through the ACL-aware map`)
}

main()
