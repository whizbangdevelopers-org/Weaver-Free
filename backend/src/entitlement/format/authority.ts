// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// VENDORED from wbd-entitlement@0de98b8 — do not edit here.
// Edit upstream, re-run scripts/vendor-entitlement.ts. audit:entitlement-vendor fails on drift.

/**
 * The authority manifest — which public keys a product's builds trust, per channel.
 *
 * This is the source the build-time seam reads. It holds **public** keys only, so it belongs in
 * the product's git tree in plaintext, and that is a feature rather than a compromise: a change to
 * what a build trusts then appears in a pull-request diff, which is the review event you want for
 * exactly this class of change.
 *
 * ## Why a manifest and not a constant edited by hand
 *
 * `ACCEPTED_PUBLIC_KEYS` began life as a literal in source, and hand-editing it works right up
 * until the first rotation — at which point the sequencing (ship the new key, then switch minting,
 * then drop the old) has to be executed correctly from memory, across two releases, by whoever is
 * doing the rotation that day. The manifest makes each of those a reviewable state of one file.
 *
 * It also makes the channel invariant checkable, which a literal never could: a release build must
 * not trust a test authority, and nothing about a base64 string in a source file reveals which kind
 * it is.
 */

/**
 * What a key is FOR.
 *
 * `production` — its private half is under custody, and it mints credentials people paid for.
 * `test` — its private half is disposable and may sit on a laptop, in CI, or in a substitute hub.
 *
 * The distinction is the entire point of the type. A test key in a release build is a signing
 * oracle handed to anyone who has ever cloned the harness.
 */
export type KeyKind = 'production' | 'test'

export interface AuthorityKey {
  /** Raw Ed25519 public key, base64url — the `x` of the JWK. */
  publicKey: string
  kind: KeyKind
  /** ISO date the key entered the manifest. Rotation is readable from these. */
  addedAt: string
  /** Free text — which ceremony, which host, which drill. */
  note?: string
}

export interface AuthorityManifest {
  /** Product this manifest belongs to. Cross-checked against the profile prefix. */
  product: string
  /** Named keys. The name is what channels reference, so a key can be described once. */
  keys: Record<string, AuthorityKey>
  /**
   * Channel → ordered key names, **newest first**.
   *
   * Order is the accepted-set order, and it is load-bearing during a rotation: the new key is
   * prepended and shipped while the old one is still present, then the old one is removed in a
   * later release. A channel that lists them the other way round still verifies correctly — the
   * verifier tries all of them — but it stops documenting which key is current.
   */
  channels: Record<string, string[]>
}

export class AuthorityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthorityError'
  }
}

/** Channels whose builds reach customers. These may never trust a `test` key. */
export const RELEASE_CHANNELS: readonly string[] = ['release']

const B64URL = /^[A-Za-z0-9_-]{43}$/ // 32 raw bytes, unpadded base64url

/**
 * Validate a manifest and resolve one channel to its ordered public keys.
 *
 * Throws rather than returning a partial result. A build that cannot determine what it trusts must
 * fail; it must never fall back to trusting nothing (which looks like a working Free-tier build and
 * would ship) or to trusting everything.
 */
export function resolveChannel(manifest: AuthorityManifest, channel: string): string[] {
  const names = manifest.channels[channel]
  if (!names) {
    throw new AuthorityError(
      `unknown channel '${channel}' — manifest defines ${Object.keys(manifest.channels).join(', ')}`,
    )
  }

  const isRelease = RELEASE_CHANNELS.includes(channel)
  const out: string[] = []
  const seen = new Set<string>()

  for (const name of names) {
    const key = manifest.keys[name]
    if (!key) {
      throw new AuthorityError(`channel '${channel}' references undefined key '${name}'`)
    }
    if (!B64URL.test(key.publicKey)) {
      throw new AuthorityError(
        `key '${name}' is not a 32-byte base64url Ed25519 public key: '${key.publicKey}'`,
      )
    }
    // THE channel invariant. A test authority in a release build hands a signing oracle to anyone
    // who has cloned the harness, and it is invisible in the artifact.
    if (isRelease && key.kind !== 'production') {
      throw new AuthorityError(
        `channel '${channel}' is a release channel and may not trust key '${name}' of kind '${key.kind}'`,
      )
    }
    if (seen.has(key.publicKey)) {
      throw new AuthorityError(`channel '${channel}' lists the same public key twice ('${name}')`)
    }
    seen.add(key.publicKey)
    out.push(key.publicKey)
  }

  if (out.length === 0) {
    // Distinct from "no channel": an empty channel is a build that verifies nothing, which is the
    // correct pre-ceremony state but must be stated deliberately, not reached by an empty array.
    throw new AuthorityError(
      `channel '${channel}' resolves to no keys — a build that trusts nothing must say so by ` +
        `omitting the channel, not by declaring it empty`,
    )
  }

  return out
}

/** Parse and validate a manifest's shape before anything reads it. */
export function parseManifest(raw: unknown): AuthorityManifest {
  if (typeof raw !== 'object' || raw === null) throw new AuthorityError('manifest is not an object')
  const m = raw as Partial<AuthorityManifest>
  if (typeof m.product !== 'string' || !m.product) throw new AuthorityError('manifest.product missing')
  if (typeof m.keys !== 'object' || m.keys === null) throw new AuthorityError('manifest.keys missing')
  if (typeof m.channels !== 'object' || m.channels === null) {
    throw new AuthorityError('manifest.channels missing')
  }
  for (const [name, key] of Object.entries(m.keys)) {
    if (key.kind !== 'production' && key.kind !== 'test') {
      throw new AuthorityError(`key '${name}' has kind '${key.kind}' — must be production or test`)
    }
    if (typeof key.addedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key.addedAt)) {
      throw new AuthorityError(`key '${name}' needs an addedAt date (YYYY-MM-DD)`)
    }
  }
  return m as AuthorityManifest
}
