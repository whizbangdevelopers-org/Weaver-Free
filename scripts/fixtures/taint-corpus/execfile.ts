// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Regression corpus — `no-raw-execfile-args` (CWE-78).
 *
 * Read and asserted by scripts/audit-taint.ts ON EVERY RUN, before it scans anything.
 * A line preceded by `// taint-expect: <rule-id>` MUST be reported; EVERY other line in
 * this directory MUST NOT be. Both halves fail the auditor.
 *
 * This file is never executed and never imported. It is deliberately vulnerable.
 *
 * AUTHORING CONSTRAINT — use a DISTINCT variable name for every case in a file.
 * Semgrep dedupes on the metavariable binding, so two cases sharing a name mask each
 * other and the corpus would silently under-test. That is a real (documented) property
 * of the engine, exercised on purpose in same-name-masking.ts rather than tripped over
 * here by accident.
 */
import { exec, execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const SAFE_NAME_RE = /^[a-z][a-z0-9-]*$/

// ---------------------------------------------------------------------------
// MUST CATCH — the shapes that were already covered
// ---------------------------------------------------------------------------

export async function directMemberRead(request: any) {
  const p = request.params
  // taint-expect: no-raw-execfile-args
  await execFileAsync('/bin/vm', ['start', p.alpha])
}

export async function destructureNoCast(request: any) {
  const { bravo } = request.params
  // taint-expect: no-raw-execfile-args
  await execFileAsync('/bin/vm', ['start', bravo])
}

export async function castNoDestructure(request: any) {
  const charlie = request.params as { name: string }
  // taint-expect: no-raw-execfile-args
  await execFileAsync('/bin/vm', ['start', charlie.name])
}

export async function inlineCast(request: any) {
  // taint-expect: no-raw-execfile-args
  await execFileAsync('/bin/vm', ['start', (request.params as { delta: string }).delta])
}

export async function templateIntoExec(request: any) {
  const { echo } = request.body
  // taint-expect: no-raw-execfile-args
  exec(`vm start ${echo}`)
}

export async function intoSpawn(request: any) {
  const { foxtrot } = request.query
  // taint-expect: no-raw-execfile-args
  spawn(foxtrot)
}

// ---------------------------------------------------------------------------
// MUST CATCH — shorthand destructuring from a TYPE-ASSERTED request field.
//
// THIS IS THE REGRESSION THIS CORPUS EXISTS FOR. It is the codebase's own idiomatic
// param read, live at 8 sites under backend/src/routes/, and it was invisible to this
// rule while the rule reported green. See the source block in
// scripts/semgrep-rules/no-raw-execfile-args.yaml for why the obvious fixes do not work.
// ---------------------------------------------------------------------------

export async function destructureAndCastParams(request: any) {
  const { golf } = request.params as { golf: string }
  // taint-expect: no-raw-execfile-args
  await execFileAsync('/bin/vm', ['start', golf])
}

export async function destructureAndCastBody(request: any) {
  const { hotel } = request.body as { hotel: string }
  // taint-expect: no-raw-execfile-args
  await execFileAsync('/bin/vm', ['start', hotel])
}

export async function destructureAndCastQuery(request: any) {
  const { india } = request.query as { india: string }
  // taint-expect: no-raw-execfile-args
  await execFileAsync('/bin/vm', ['start', india])
}

export async function destructureAndCastMultiKey(request: any) {
  const { juliet, kilo } = request.params as { juliet: string; kilo: string }
  // taint-expect: no-raw-execfile-args
  await execFileAsync('/bin/vm', [juliet, kilo])
}

// Neighbouring shapes that the engine DOES bind through. They are here so that a future
// "simplification" of the source block cannot quietly drop them: each one passed before
// the fix and must still pass after it.

export async function destructureFromAsAny(request: any) {
  const { lima } = request.params as any
  // taint-expect: no-raw-execfile-args
  await execFileAsync('/bin/vm', ['start', lima])
}

export async function destructureWithRename(request: any) {
  const { name: mike } = request.params as { name: string }
  // taint-expect: no-raw-execfile-args
  await execFileAsync('/bin/vm', ['start', mike])
}

export async function twoStepCastThenDestructure(request: any) {
  const november = request.params as { oscar: string }
  const { oscar } = november
  // taint-expect: no-raw-execfile-args
  await execFileAsync('/bin/vm', ['start', oscar])
}

// ---------------------------------------------------------------------------
// MUST NOT FLAG — a rule that fires on these gets switched off, after which it
// catches nothing at all. The IGNORE half is what makes the CATCH half mean anything.
// ---------------------------------------------------------------------------

// Fully literal arguments — no request data anywhere.
export async function literalArgsOnly() {
  await execFileAsync('/bin/vm', ['list', '--all'])
}

// Validated against the allowlist regex before use. This is the SANCTIONED pattern, and
// it must keep working for the NEW source form too — if the sanitizer stopped applying to
// destructure+cast bindings, every correctly-written route in the codebase would light up
// and the rule would be disabled within a day.
export async function sanitizedBeforeUse(request: any) {
  const { papa } = request.params as { papa: string }
  if (!/^[a-z][a-z0-9-]*$/.test(papa)) {
    throw new Error('invalid name')
  }
  await execFileAsync('/bin/vm', ['start', papa])
}

// Same, via the plain (non-cast) read.
export async function sanitizedPlainRead(request: any) {
  const { quebec } = request.params
  if (!/^[a-z][a-z0-9-]*$/.test(quebec)) {
    throw new Error('invalid name')
  }
  await execFileAsync('/bin/vm', ['start', quebec])
}

// Destructured from something that is not a request field.
export async function destructuredFromConfig(config: any) {
  const { romeo } = config.paths as { romeo: string }
  await execFileAsync('/bin/vm', ['start', romeo])
}

// A request field that never reaches a command sink.
export async function requestValueNeverExecuted(request: any, reply: any) {
  const { sierra } = request.params as { sierra: string }
  reply.send({ ok: true, sierra })
}

// A request field reaching a NON-sink call that merely looks similar.
export async function notASink(request: any, logger: any) {
  const { tango } = request.params as { tango: string }
  logger.info(`starting ${tango}`)
}

// Shared constant regex used as the guard. Present because backend/src/routes/console.ts
// validates with a named constant (VM_NAME_RE), not an inline literal — so this documents
// that the rule's sanitizer list does NOT recognise the named form. It is listed as
// must-not-flag only because the value never reaches a sink here; see path.ts for the
// case where a named-constant guard is the ONLY thing standing between input and a sink.
export async function namedConstantGuard(request: any, reply: any) {
  const { uniform } = request.params as { uniform: string }
  if (!SAFE_NAME_RE.test(uniform)) {
    return reply.code(400).send({ error: 'invalid' })
  }
  return reply.send({ ok: true })
}
