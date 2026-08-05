// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Regression corpus — `no-user-input-in-path` (CWE-22).
 *
 * See execfile.ts for the annotation contract and the distinct-variable-name constraint.
 * This rule shares its `pattern-sources` with no-raw-execfile-args and no-ssrf-in-fetch,
 * so it inherited the same destructure+cast blind spot. The cases below are what keeps
 * the three source blocks honest: editing one rule's sources and not the others fails here.
 */
import { readFile, readFileSync, writeFileSync, mkdir, unlink } from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// MUST CATCH
// ---------------------------------------------------------------------------

export async function joinDirect(request: any) {
  const p = request.params
  // taint-expect: no-user-input-in-path
  const target = path.join('/var/lib/weaver', p.alpha)
  return target
}

export async function resolveDestructured(request: any) {
  const { bravo } = request.query
  // taint-expect: no-user-input-in-path
  return path.resolve('/var/lib/weaver', bravo)
}

// The repaired shape — shorthand destructuring from a type-asserted request field.
export async function joinDestructuredCastParams(request: any) {
  const { charlie } = request.params as { charlie: string }
  // taint-expect: no-user-input-in-path
  return path.join('/var/lib/weaver', charlie)
}

export async function joinDestructuredCastBody(request: any) {
  const { delta } = request.body as { delta: string }
  // taint-expect: no-user-input-in-path
  return path.join('/var/lib/weaver', delta)
}

export async function readFileFromCast(request: any) {
  const { echo } = request.params as { echo: string }
  // taint-expect: no-user-input-in-path
  readFileSync(echo)
}

export async function writeFileFromCast(request: any) {
  const { foxtrot } = request.body as { foxtrot: string }
  // taint-expect: no-user-input-in-path
  writeFileSync(foxtrot, 'data')
}

export async function unlinkFromCast(request: any) {
  const { golf } = request.params as { golf: string }
  // taint-expect: no-user-input-in-path
  unlink(golf, () => undefined)
}

export async function mkdirFromCast(request: any) {
  const { hotel } = request.body as { hotel: string }
  // taint-expect: no-user-input-in-path
  mkdir(hotel, () => undefined)
}

export async function readFileAsyncFromCast(request: any) {
  const { india } = request.params as { india: string }
  // taint-expect: no-user-input-in-path
  readFile(india, () => undefined)
}

// ---------------------------------------------------------------------------
// MUST NOT FLAG
// ---------------------------------------------------------------------------

// Entirely internal path construction.
export function staticPath() {
  return path.join('/var/lib/weaver', 'registry.json')
}

// The sanctioned validate-then-use shape. This is the case that would have made the
// source fix unshippable: before the guard-region sanitizer, closing the destructure+cast
// hole made correctly-guarded routes light up, and a rule that flags correct code is a
// rule somebody disables.
export async function guardedThenJoined(request: any) {
  const { juliet } = request.params as { juliet: string }
  if (!/^[a-z][a-z0-9-]*$/.test(juliet)) {
    throw new Error('invalid name')
  }
  return path.join('/var/lib/weaver', juliet)
}

// Positive-polarity guard, same contract.
export async function guardedPositivePolarity(request: any) {
  const { kilo } = request.params as { kilo: string }
  if (/^[a-z][a-z0-9-]*$/.test(kilo)) {
    return path.join('/var/lib/weaver', kilo)
  }
  return null
}

// Not a request field.
export function fromConfigObject(config: any) {
  const { lima } = config.paths as { lima: string }
  return path.join('/var/lib/weaver', lima)
}

// Request field that never reaches a path sink.
export async function neverReachesPathSink(request: any, reply: any) {
  const { mike } = request.params as { mike: string }
  reply.send({ mike })
}
