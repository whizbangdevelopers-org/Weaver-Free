// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Integrity verification for downloaded distro images (SEC-031).
 *
 * A base image becomes the guest's root filesystem. It is the largest untrusted input the product
 * ingests, and until 2026-08-23 it was ingested with no verification at all: `DISTRO_IMAGES`
 * carried a URL and nothing else, and `downloadImage()` streamed the response straight to disk.
 *
 * **"TLS covers it" was false for two independent reasons**, which is why this exists rather than
 * a note telling people to use HTTPS:
 *   - the CirrOS entry was plain `http://`, so there was no transport protection at all;
 *   - `followRedirects()` re-derived its client from each new URL's scheme, so an `https://`
 *     source redirecting to `http://` was followed silently. TLS was not even a reliable floor.
 *
 * ## Why the digest is FETCHED, not pinned
 *
 * The obvious design is a committed `sha256` per entry. It is also wrong here, and the reason is
 * worth writing down because it looks like the more rigorous option:
 *
 * Three of the six catalog URLs point at a MOVING target — Arch's `images/latest/`, Ubuntu's
 * `noble/current/`, Debian's `bookworm/latest/`. A committed digest against a moving URL is
 * invalid the moment upstream rebuilds, which is roughly monthly. Pinning the URLs instead trades
 * one security property for another: reproducible provisioning, bought with images that silently
 * age out of patch coverage and a refresh cadence somebody has to remember. This codebase has
 * measured, twice, what happens to controls that depend on remembering.
 *
 * So the default is `published`: read the checksum file the distro publishes BESIDE the image, in
 * the same directory, which moves with it. `pinned` stays available and is the right answer for an
 * immutable URL (CirrOS is pinned to release `0.6.2/`) or an internal mirror.
 *
 * **Be precise about what `published` buys**, because overstating it is worse than not having it:
 * it detects truncation, corruption in transit, a CDN or mirror serving something other than what
 * its own manifest says, and a redirect swapping the payload. It does NOT defend against a
 * compromised origin, which could rewrite image and manifest together. The upgrade for that is
 * signature verification — Fedora, Debian, Alpine and Arch all publish detached signatures, and
 * Fedora's CHECKSUM is PGP-clearsigned already. That is a separate piece of work, not this one.
 */

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

export type DigestAlgorithm = 'sha256' | 'sha512'

/** The expected digest is committed here. Correct only for an immutable URL. */
export interface PinnedDigest {
  kind: 'pinned'
  algorithm: DigestAlgorithm
  /** Lowercase hex. */
  value: string
  /** Why this entry is pinned rather than published — required, so the choice stays reviewable. */
  reason: string
}

/** The expected digest is read from a checksum file published beside the image. */
export interface PublishedDigest {
  kind: 'published'
  algorithm: DigestAlgorithm
  /** Absolute URL of the checksum file. Must be https — see assertChecksumUrl. */
  url: string
  /**
   * The filename to match inside the checksum file.
   *
   * Required even for single-entry files. A checksum file listing many artifacts (Ubuntu's
   * SHA256SUMS, Fedora's CHECKSUM) will happily yield SOME digest if you take the first line, and
   * that digest belongs to a different image — a verification that passes against the wrong file
   * is worse than none, because it reports success.
   */
  filename: string
}

export type DigestSpec = PinnedDigest | PublishedDigest

const HEX_BY_ALGORITHM: Record<DigestAlgorithm, number> = { sha256: 64, sha512: 128 }

/**
 * Parse a published checksum file and return the digest for `filename`.
 *
 * Handles the three shapes the catalog's distros actually publish, verified against live files on
 * 2026-08-23 rather than assumed:
 *
 *   GNU coreutils   `<hex>  <filename>` or `<hex> *<filename>`  — Ubuntu, Debian, Arch
 *   BSD / OpenSSL   `SHA256 (<filename>) = <hex>`                — Fedora (inside PGP clearsign)
 *   bare            `<hex>` alone, no filename                   — some Alpine `.sha512` files
 *
 * Returns null when no line matches, and the caller MUST treat null as a failure. It deliberately
 * does not fall back to "the only digest in the file": a file with one line today can have two
 * tomorrow, and the fallback would then silently select the wrong artifact.
 *
 * The bare form is the one exception, and only because there is no filename to disagree with — a
 * file containing exactly one hex token of the right length is unambiguous.
 */
export function parseChecksumFile(
  text: string,
  algorithm: DigestAlgorithm,
  filename: string,
): string | null {
  const width = HEX_BY_ALGORITHM[algorithm]
  const hex = `[0-9a-fA-F]{${width}}`
  // Match on the BASENAME. Checksum files disagree about whether they carry a path prefix
  // (`./file`, `*file`, `dir/file`), and that is presentation, not identity.
  const base = filename.split('/').pop() ?? filename
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const lines = text.split('\n')

  // GNU: <hex><space><space-or-asterisk><name>
  const gnu = new RegExp(`^(${hex})[ \\t]+[* ]?(.*)$`)
  for (const line of lines) {
    const m = gnu.exec(line.trim())
    if (m && (m[2] ?? '').split('/').pop() === base) return m[1]!.toLowerCase()
  }

  // BSD: ALGO (<name>) = <hex>
  const bsd = new RegExp(`^${algorithm}\\s*\\(\\s*${escaped}\\s*\\)\\s*=\\s*(${hex})$`, 'i')
  for (const line of lines) {
    const m = bsd.exec(line.trim())
    if (m) return m[1]!.toLowerCase()
  }

  // Bare: the whole file is one digest.
  const bare = new RegExp(`^(${hex})$`)
  const nonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'))
  if (nonEmpty.length === 1) {
    const m = bare.exec(nonEmpty[0]!)
    if (m) return m[1]!.toLowerCase()
  }

  return null
}

/**
 * A checksum URL must be HTTPS.
 *
 * Fetching the expected digest over plaintext defeats the entire mechanism: an attacker who can
 * rewrite the image in transit can rewrite the digest that would have caught it, and the run then
 * reports a successful verification. That is strictly worse than no verification, because it
 * manufactures a green.
 */
export function assertChecksumUrl(url: string): URL {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') {
    throw new Error(
      `checksum URL must be https, got "${parsed.protocol}" (${url}) — ` +
        'a digest fetched over plaintext can be rewritten by whoever rewrote the image',
    )
  }
  return parsed
}

/**
 * Resolve one redirect hop and decide whether it is allowed.
 *
 * Extracted as a pure function ON PURPOSE: the policy it encodes is the whole of SEC-031's
 * redirect half, and inside the http callback it could only be exercised by standing up a server
 * that redirects — which `validateExternalUrl` then refuses, because it is on localhost. A rule
 * that can only be tested by disabling the rule next to it does not get tested.
 *
 * Two refusals, and they failed differently before:
 *
 *   SSRF   — the caller validated the FIRST url and then trusted every `Location` header. An
 *            allowed host could redirect to 169.254.169.254 or any RFC1918 address and the guard
 *            was a formality. A guard applied to one hop of a chain is not a guard.
 *   downgrade — the client was chosen per-URL (`url.startsWith('https')`), so https -> http was
 *            not merely permitted, it was automatic and silent. This is why "the images come over
 *            TLS" was untrue even for entries whose catalog URL is https.
 *
 * @param location the raw `Location` header — may be relative, hence `previous` as the base
 * @param previous the URL that produced this redirect
 */
export function resolveRedirect(
  location: string,
  previous: URL,
  validate: (raw: string) => URL,
): URL {
  const target = validate(new URL(location, previous.href).href)
  if (previous.protocol === 'https:' && target.protocol !== 'https:') {
    throw new Error(
      `refusing redirect from https to ${target.protocol} (${previous.href} -> ${target.href}) ` +
        '— a downgrade puts the payload back on the wire in plaintext',
    )
  }
  return target
}

/** Stream a file through a hash. Never buffers the whole image — these are hundreds of MB. */
export async function hashFile(path: string, algorithm: DigestAlgorithm): Promise<string> {
  const hash = createHash(algorithm)
  const stream = createReadStream(path)
  for await (const chunk of stream) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

/** Normalise + validate an expected digest so a malformed catalog entry fails loudly at use. */
export function normaliseExpected(value: string, algorithm: DigestAlgorithm): string {
  const v = value.trim().toLowerCase()
  const width = HEX_BY_ALGORITHM[algorithm]
  if (!new RegExp(`^[0-9a-f]{${width}}$`).test(v)) {
    throw new Error(
      `expected ${algorithm} digest must be ${width} hex characters, got ${v.length}: "${value}"`,
    )
  }
  return v
}
