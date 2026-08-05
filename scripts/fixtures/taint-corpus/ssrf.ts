// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Regression corpus — `no-ssrf-in-fetch` (CWE-918).
 *
 * See execfile.ts for the annotation contract and the distinct-variable-name constraint.
 * Third consumer of the shared `$REQ.params|body|query` source block.
 */
import axios from 'axios'

// ---------------------------------------------------------------------------
// MUST CATCH
// ---------------------------------------------------------------------------

export async function fetchDirect(request: any) {
  const p = request.query
  // taint-expect: no-ssrf-in-fetch
  await fetch(p.alpha)
}

export async function fetchDestructuredCast(request: any) {
  const { bravo } = request.query as { bravo: string }
  // taint-expect: no-ssrf-in-fetch
  await fetch(bravo)
}

export async function axiosGetFromCast(request: any) {
  const { charlie } = request.params as { charlie: string }
  // taint-expect: no-ssrf-in-fetch
  await axios.get(charlie)
}

export async function axiosPostFromCast(request: any) {
  const { delta } = request.body as { delta: string }
  // taint-expect: no-ssrf-in-fetch
  await axios.post(delta, {})
}

export async function newUrlFromCast(request: any) {
  const { echo } = request.query as { echo: string }
  // taint-expect: no-ssrf-in-fetch
  return new URL(echo)
}

// ---------------------------------------------------------------------------
// MUST NOT FLAG
// ---------------------------------------------------------------------------

// Internal, non-request URL.
export async function fetchInternalConstant() {
  await fetch('http://127.0.0.1:3110/api/health')
}

// The sanctioned allowlist check, in the validate-then-use shape.
export async function allowlistedThenFetched(request: any) {
  const { foxtrot } = request.query as { foxtrot: string }
  if (!isAllowedUrl(foxtrot)) {
    throw new Error('host not allowed')
  }
  await fetch(foxtrot)
}

// Host-membership check, positive polarity.
export async function hostCheckedThenFetched(request: any) {
  const { golf } = request.query as { golf: string }
  if (ALLOWED_HOSTS.includes(golf)) {
    await fetch(golf)
  }
}

// Request field that never reaches an outbound call.
export async function neverFetched(request: any, reply: any) {
  const { hotel } = request.query as { hotel: string }
  reply.send({ hotel })
}

declare function isAllowedUrl(u: string): boolean
declare const ALLOWED_HOSTS: string[]
