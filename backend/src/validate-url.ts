// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Validates that a URL is safe for server-side fetching. Blocks private/internal targets to
 * prevent SSRF.
 *
 * WHY THIS CLASSIFIES NUMERICALLY INSTEAD OF MATCHING STRING PREFIXES
 * ------------------------------------------------------------------
 * The previous implementation compared `hostname` against literals and prefixes — `=== '127.0.0.1'`,
 * `startsWith('10.')`, `startsWith('fd')`. That is the defect class, not an instance of it, and it
 * failed in two ways at once:
 *
 *   1. `URL.hostname` returns an IPv6 literal WITH ITS BRACKETS — `[fd00::1]`, never `fd00::1`. So
 *      `startsWith('fd')` and `startsWith('fe80')` could never match anything. Both IPv6 lines were
 *      dead from the day they were written, and looked like protection the whole time.
 *   2. `::ffff:10.0.0.1` is the same address as `10.0.0.1` and matches none of the IPv4 prefixes,
 *      so every IPv4 rule could be walked around by writing the address the other way. `[::]` was
 *      allowed outright and routes to localhost on a normal dual-stack host.
 *
 * A prefix check answers "does this text look like an address in a range". The question is "IS this
 * address in the range", and the two diverge every time a spelling exists that the author did not
 * enumerate. Classifying the parsed value has no such tail.
 *
 * WHAT THIS DOES NOT DEFEND AGAINST, STATED SO IT IS NOT MISTAKEN FOR COVERED
 * ---------------------------------------------------------------------------
 * DNS rebinding. A NAME is checked here and RESOLVED later by the HTTP client, so a host that
 * answers publicly at validation time and privately at connection time defeats any pre-flight
 * check, including this one. Closing it needs resolve-then-pin-the-socket, which is a different
 * change with a different blast radius. `health-probe.ts` takes the other route for the same
 * reason — it refuses names outright — and can afford to, because a probe target is always a
 * literal on the operator's own network. An image mirror is not.
 *
 * WHY `isPrivateIpv4` FROM health-probe.ts IS NOT REUSED HERE, THOUGH IT LOOKS IDENTICAL
 * --------------------------------------------------------------------------------------
 * It answers the opposite question and would invert the most important rule in this file. There,
 * `isPrivateIpv4('169.254.169.254')` returns FALSE — link-local is deliberately excluded, because
 * no workload is reachable there — and false means REFUSE TO PROBE. Here, false means ALLOW THE
 * FETCH. Sharing the predicate would hand cloud-metadata access to any caller of this function,
 * and the change would read as tidy deduplication in review. Same shape, opposite polarity: keep
 * them apart.
 */
import { isIPv4, isIPv6 } from 'node:net'

/**
 * Pure: is this address the local host itself?
 *
 * Kept separate from the general private-range check so the two keep their distinct messages —
 * "localhost" and "private/internal networks" name different mistakes, and callers (and
 * image-digest.spec.ts) distinguish them. Loopback is 127.0.0.0/8 entire, not just 127.0.0.1.
 */
export function isLoopbackIp(ip: string): boolean {
  if (isIPv4(ip)) return ip.split('.').map(Number)[0] === 127
  const g = expandIpv6(ip)
  if (!g) return false
  const low = g.slice(0, 5).every(n => n === 0)
  if (low && g[5] === 0 && g[6] === 0 && (g[7] === 0 || g[7] === 1)) return true // :: and ::1
  if (low && g[5] === 0xffff && (g[6]! >> 8) === 127) return true                // ::ffff:127.x.x.x
  return false
}

/** Pure: is this dotted-quad inside a range we must never fetch from? */
export function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = parts as [number, number, number, number]
  if (a === 0) return true                          // 0.0.0.0/8 — "this host"
  if (a === 127) return true                        // loopback
  if (a === 10) return true                         // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true  // RFC1918
  if (a === 192 && b === 168) return true           // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true // RFC6598 CGNAT
  if (a === 169 && b === 254) return true           // link-local + cloud metadata
  if (a >= 224) return true                         // multicast + reserved
  return false
}

/**
 * Pure: expand any IPv6 spelling to its eight 16-bit groups, or null if unparseable.
 *
 * Handles `::` compression and a trailing embedded IPv4 (`::ffff:10.0.0.1`), because those are the
 * two spellings an attacker reaches for and the two a prefix check cannot see.
 */
export function expandIpv6(raw: string): number[] | null {
  let text = raw.trim().toLowerCase()
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1)
  text = text.split('%')[0]! // strip a zone id (fe80::1%eth0)

  // A trailing dotted-quad becomes two hex groups, so the rest can be parsed uniformly.
  const v4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(text)
  if (v4) {
    if (!isIPv4(v4[1]!)) return null
    const o = v4[1]!.split('.').map(Number)
    const hex = `${((o[0]! << 8) | o[1]!).toString(16)}:${((o[2]! << 8) | o[3]!).toString(16)}`
    text = text.slice(0, v4.index) + hex
  }

  const halves = text.split('::')
  if (halves.length > 2) return null
  const parse = (s: string): number[] | null => {
    if (s === '') return []
    const out: number[] = []
    for (const g of s.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null
      out.push(parseInt(g, 16))
    }
    return out
  }
  const head = parse(halves[0]!)
  if (head === null) return null
  if (halves.length === 1) return head.length === 8 ? head : null
  const tail = parse(halves[1]!)
  if (tail === null) return null
  const fill = 8 - head.length - tail.length
  if (fill < 0) return null
  return [...head, ...Array(fill).fill(0), ...tail]
}

/** Pure: is this IPv6 address one we must never fetch from? */
export function isBlockedIpv6(raw: string): boolean {
  const g = expandIpv6(raw)
  if (!g) return false
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [number, number, number, number, number, number, number, number]

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) carry a v4 address in the low
  // 32 bits. Re-check it as IPv4 — this is the bypass that made every v4 rule optional.
  const topFiveZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0
  if (topFiveZero && (g5 === 0xffff || g5 === 0)) {
    const embedded = `${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`
    if (isBlockedIpv4(embedded)) return true
    if (g5 === 0 && g6 === 0 && g7 <= 1) return true // :: (unspecified) and ::1 (loopback)
  }
  // NAT64 well-known prefix 64:ff9b::/96 also embeds a v4 address.
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    if (isBlockedIpv4(`${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`)) return true
  }

  if ((g0 & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local (fc.. AND fd..)
  if ((g0 & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((g0 & 0xff00) === 0xff00) return true // ff00::/8 multicast
  return false
}

export function validateExternalUrl(raw: string): URL {
  const url = new URL(raw)

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Invalid URL scheme "${url.protocol}" — only http/https allowed`)
  }

  const hostname = url.hostname.toLowerCase()
  // Brackets are part of `hostname` for an IPv6 literal. Stripping them here — once, in the one
  // place that reads the value — is what the old prefix checks silently failed to do.
  const bare = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname

  if (hostname === 'localhost' || hostname.endsWith('.localhost') || isLoopbackIp(bare)) {
    throw new Error('URL must not point to localhost')
  }

  if (isIPv4(bare) ? isBlockedIpv4(bare) : isIPv6(bare) && isBlockedIpv6(bare)) {
    throw new Error('URL must not point to private/internal networks')
  }

  return url
}
