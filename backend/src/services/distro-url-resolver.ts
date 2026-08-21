// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Distro image URL resolution — find the CURRENT download URL when a catalog entry has rotted.
 *
 * Free tier. Weaver already *detects* a dead image URL (the daily HEAD sweep in Settings →
 * Distributions) and then asks the admin to go find the replacement by hand. Detection without
 * resolution puts the research on the user for a fact the distro publishes.
 *
 * WHY URLS ROT, measured against the shipped catalog on 2026-08-10:
 *
 *   Entries that never break pin a STABLE POINTER — ubuntu `noble/current/`, debian
 *   `bookworm/latest/`, rocky/alma `...latest.x86_64.qcow2`. The publisher maintains the
 *   redirect, so there is nothing to rot.
 *
 *   Entries that broke pinned a VERSION AND A BUILD:
 *     fedora        …/releases/42/Cloud/…/Fedora-Cloud-Base-Generic-42-1.1.x86_64.qcow2  → 404
 *     nixos-desktop …/nixos-25.11/latest-nixos-gnome-x86_64-linux.iso                    → 404
 *
 *   Fedora 42 went EOL and its images moved to the archive. NixOS renamed the `gnome` ISO
 *   variant to `graphical`; `minimal` on the identical channel still resolved, which is what
 *   made it look like a Fedora-shaped problem rather than a rename.
 *
 * THE RULE THIS ENCODES — an index is a claim, not a fact.
 *
 *   Fedora's own `releases.json` still advertises the exact F42 URL that returns 404. A resolver
 *   that trusts an index is no better than the hardcoded literal it replaces; it just fails with
 *   more confidence. So every candidate this module produces is VERIFIED with a real request
 *   before it is offered, and the first verified candidate wins. Nothing here returns a URL it
 *   has not seen answer.
 *
 * The candidate GENERATORS below are pure — string in, strings out, no network — so they are
 * unit-testable without touching a mirror. `resolveDistroUrl` is the only impure part and takes
 * its probe as a parameter.
 */

/** A candidate URL plus why it was proposed — surfaced to the admin, never applied silently. */
export interface UrlCandidate {
  url: string
  /** Which generator produced it — shown so an admin can judge the suggestion. */
  strategy: 'nixos-variant-rename' | 'nixos-channel-bump' | 'fedora-index' | 'version-bump' | 'as-recorded'
  note: string
}

export interface ResolveOutcome {
  resolved: string | null
  strategy: UrlCandidate['strategy'] | null
  /** Every candidate tried, in order, with its verification result. Diagnosis without a re-run. */
  tried: { url: string; strategy: string; status: number | 'error' }[]
}

/** NixOS ISO variants, current name first. `gnome` and the plasma variants are historical. */
const NIXOS_VARIANTS = ['minimal', 'graphical', 'gnome', 'plasma6', 'plasma5'] as const

/**
 * Candidates for a `channels.nixos.org` ISO whose variant or channel has moved.
 *
 * Two independent things rot here and they need different fixes: the VARIANT can be renamed
 * inside a live channel (gnome → graphical, 25.11), and the CHANNEL itself goes EOL twice a
 * year. Generating both keeps a single rename from looking like a channel problem.
 */
export function nixosCandidates(url: string): UrlCandidate[] {
  const m = url.match(/^(https?:\/\/channels\.nixos\.org\/nixos-)([0-9]{2}\.[0-9]{2})(\/latest-nixos-)([a-z0-9-]+)(-x86_64-linux\.iso)$/)
  if (!m) return []
  const [, prefix, channel, mid, variant, suffix] = m as unknown as string[]
  const out: UrlCandidate[] = []

  for (const v of NIXOS_VARIANTS) {
    if (v === variant) continue
    out.push({
      url: `${prefix}${channel}${mid}${v}${suffix}`,
      strategy: 'nixos-variant-rename',
      note: `same channel ${channel}, variant '${variant}' → '${v}'`,
    })
  }

  // Channel bump: NixOS releases in .05 and .11 each year, so the successor is deterministic.
  const [yy, mm] = channel!.split('.')
  const nextChannel = mm === '05' ? `${yy}.11` : `${String(Number(yy) + 1).padStart(2, '0')}.05`
  out.push({
    url: `${prefix}${nextChannel}${mid}${variant}${suffix}`,
    strategy: 'nixos-channel-bump',
    note: `same variant '${variant}', channel ${channel} → ${nextChannel}`,
  })
  return out
}

/**
 * Candidates from Fedora's `releases.json`, newest release first.
 *
 * The caller supplies the parsed index; this stays pure. Filters to the same variant/arch and to
 * `.qcow2`, because the index also carries ISOs, UEFI-UKI images and every other arch.
 *
 * **Newest-first is a preference, not a guarantee** — the index lists EOL releases whose files are
 * gone, so the verification step is what actually decides. Ordering only means the caller probes
 * the most useful one first.
 */
export function fedoraCandidates(index: unknown, opts: { arch?: string; variant?: string } = {}): UrlCandidate[] {
  if (!Array.isArray(index)) return []
  const arch = opts.arch ?? 'x86_64'
  const variant = opts.variant ?? 'Cloud'

  const rows = index.filter((r): r is Record<string, string> => {
    if (!r || typeof r !== 'object') return false
    const row = r as Record<string, unknown>
    return (
      row.variant === variant &&
      row.arch === arch &&
      typeof row.link === 'string' &&
      row.link.endsWith('.qcow2') &&
      // Generic is the plain cloud image; UEFI-UKI is a different product and not a drop-in.
      row.link.includes('Cloud-Base-Generic')
    )
  })

  const seen = new Set<string>()
  return rows
    .sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))
    .filter((r) => (seen.has(r.link!) ? false : (seen.add(r.link!), true)))
    .map((r) => ({
      url: r.link!,
      strategy: 'fedora-index' as const,
      note: `Fedora ${r.version} ${variant} ${arch} (from releases.json — verified before use, because the index still lists archived releases)`,
    }))
}

/**
 * Last-resort generic: bump the first version-looking number in the path.
 *
 * Deliberately narrow. It only touches a bare `/<digits>/` path segment, never a version embedded
 * in a filename, because incrementing `Fedora-Cloud-Base-Generic-42-1.1` produces a filename no
 * publisher ever created — a plausible URL that 404s is worse than no suggestion, since it costs
 * an admin a round trip to disprove.
 */
export function versionBumpCandidates(url: string, steps = 2): UrlCandidate[] {
  const m = url.match(/\/(\d{1,3})\//)
  if (!m) return []
  const current = Number(m[1])
  const out: UrlCandidate[] = []
  for (let i = 1; i <= steps; i++) {
    const next = current + i
    out.push({
      url: url.replace(`/${current}/`, `/${next}/`),
      strategy: 'version-bump',
      note: `path version ${current} → ${next}`,
    })
  }
  return out
}

/** Probe signature — injected so resolution is testable without a network. */
export type HeadProbe = (url: string) => Promise<number | 'error'>

/**
 * Try the recorded URL, then each candidate, and return the first that actually answers.
 *
 * Ordering: the recorded URL first, because a transient mirror hiccup must not rewrite a catalog
 * entry that was correct all along. Only a URL that genuinely fails earns a replacement.
 */
export async function resolveDistroUrl(
  recordedUrl: string,
  candidates: UrlCandidate[],
  probe: HeadProbe,
): Promise<ResolveOutcome> {
  const tried: ResolveOutcome['tried'] = []
  const ordered: UrlCandidate[] = [
    { url: recordedUrl, strategy: 'as-recorded', note: 'the URL already in the catalog' },
    ...candidates,
  ]

  const seen = new Set<string>()
  for (const c of ordered) {
    if (seen.has(c.url)) continue
    seen.add(c.url)
    const status = await probe(c.url)
    tried.push({ url: c.url, strategy: c.strategy, status })
    if (typeof status === 'number' && status >= 200 && status < 300) {
      return { resolved: c.url, strategy: c.strategy, tried }
    }
  }
  return { resolved: null, strategy: null, tried }
}

/**
 * True when the URL's HOST is `domain` or a subdomain of it.
 *
 * Deliberately not `url.includes(domain)`, which is what this dispatched on until 2026-08-21.
 * A substring test matches the domain anywhere in the URL — in the path, in a query parameter,
 * or as the left-hand label of a lookalike — so `https://evil.example/?ref=fedoraproject.org`
 * and `https://fedoraproject.org.evil.example/` both reached the Fedora generator.
 *
 * CodeQL flags that as js/incomplete-url-substring-sanitization, and the security framing
 * undersells it: nothing here grants trust on the strength of this test, so it was never a
 * sanitizer. It is a DISPATCHER, and it was dispatching on the wrong thing — a plain
 * correctness bug that a security rule happened to notice first.
 *
 * Returns false rather than throwing when the value does not parse as a URL: a catalog entry
 * can hold anything an admin typed, and an unparseable one matches no generator.
 */
export function isHost(url: string, domain: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  return host === domain || host.endsWith(`.${domain}`)
}

/** Build the candidate list for an entry from whatever generators apply to it. */
export function candidatesFor(url: string, fedoraIndex?: unknown): UrlCandidate[] {
  const out: UrlCandidate[] = []
  if (isHost(url, 'channels.nixos.org')) out.push(...nixosCandidates(url))
  if (isHost(url, 'fedoraproject.org') && fedoraIndex !== undefined) out.push(...fedoraCandidates(fedoraIndex))
  out.push(...versionBumpCandidates(url))
  return out
}
