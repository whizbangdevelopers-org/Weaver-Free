// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Regression corpus — `no-unvalidated-jwt-claim` (CWE-347).
 *
 * See execfile.ts for the annotation contract and the distinct-variable-name constraint.
 *
 * This rule does NOT share the request-field sources, so it never had the destructure+cast
 * hole. It is in the corpus anyway: all four rules ship in one auditor, and a corpus that
 * covers three of them would report "the taint rules are verified" while one of them is
 * untested — the same shape of half-truth the corpus exists to prevent.
 */
import jwt from 'jsonwebtoken'

// ---------------------------------------------------------------------------
// MUST CATCH — claims read from an UNVERIFIED payload
// ---------------------------------------------------------------------------

export function roleFromDecode(token: string) {
  const alpha = jwt.decode(token) as any
  // taint-expect: no-unvalidated-jwt-claim
  return alpha.role
}

export function subFromDecode(token: string) {
  const bravo = jwt.decode(token) as any
  // taint-expect: no-unvalidated-jwt-claim
  return bravo.sub
}

export function usernameFromDecode(token: string) {
  const charlie = jwt.decode(token) as any
  // taint-expect: no-unvalidated-jwt-claim
  return charlie.username
}

export function claimFromManualBase64(token: string) {
  const delta = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
  // taint-expect: no-unvalidated-jwt-claim
  return delta.role
}

export function claimFromAtob(token: string) {
  const echo = JSON.parse(atob(token.split('.')[1]))
  // taint-expect: no-unvalidated-jwt-claim
  return echo.sub
}

// ---------------------------------------------------------------------------
// MUST NOT FLAG — the payload was actually verified
// ---------------------------------------------------------------------------

export function roleFromVerify(token: string, secret: string) {
  const foxtrot = jwt.verify(token, secret) as any
  return foxtrot.role
}

export async function roleFromFastifyJwtVerify(request: any) {
  const golf = await request.jwtVerify()
  return golf.role
}

// A decoded payload used for something that is not an auth decision — logging the
// issuer of a token you are about to reject is not a privilege check.
export function loggedNotAuthorized(token: string, logger: any) {
  const hotel = jwt.decode(token) as any
  logger.debug({ iss: hotel.iss })
}
