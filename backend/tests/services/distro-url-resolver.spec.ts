// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// Every case here is built from a URL that was MEASURED against the live mirrors on 2026-08-10,
// not invented. The two failures are the ones the catalog actually shipped.
import { describe, it, expect } from 'vitest'
import {
  nixosCandidates,
  fedoraCandidates,
  versionBumpCandidates,
  candidatesFor,
  isHost,
  resolveDistroUrl,
  type HeadProbe,
} from '../../src/services/distro-url-resolver.js'

const DEAD_NIXOS = 'https://channels.nixos.org/nixos-25.11/latest-nixos-gnome-x86_64-linux.iso'
const LIVE_NIXOS = 'https://channels.nixos.org/nixos-25.11/latest-nixos-graphical-x86_64-linux.iso'
const DEAD_FEDORA =
  'https://download.fedoraproject.org/pub/fedora/linux/releases/42/Cloud/x86_64/images/Fedora-Cloud-Base-Generic-42-1.1.x86_64.qcow2'
const LIVE_FEDORA =
  'https://download.fedoraproject.org/pub/fedora/linux/releases/44/Cloud/x86_64/images/Fedora-Cloud-Base-Generic-44-1.7.x86_64.qcow2'

describe('nixosCandidates', () => {
  it('offers the variant rename that actually fixed nixos-desktop', () => {
    const urls = nixosCandidates(DEAD_NIXOS).map((c) => c.url)
    expect(urls).toContain(LIVE_NIXOS)
  })

  it('keeps the channel when renaming the variant', () => {
    for (const c of nixosCandidates(DEAD_NIXOS).filter((c) => c.strategy === 'nixos-variant-rename')) {
      expect(c.url).toContain('nixos-25.11/')
    }
  })

  it('also offers the next channel, since a channel goes EOL twice a year', () => {
    const bump = nixosCandidates(DEAD_NIXOS).find((c) => c.strategy === 'nixos-channel-bump')
    expect(bump?.url).toBe('https://channels.nixos.org/nixos-26.05/latest-nixos-gnome-x86_64-linux.iso')
  })

  it('rolls the year when bumping a .11 channel', () => {
    const from = 'https://channels.nixos.org/nixos-25.05/latest-nixos-minimal-x86_64-linux.iso'
    const bump = nixosCandidates(from).find((c) => c.strategy === 'nixos-channel-bump')
    expect(bump?.url).toContain('nixos-25.11/')
  })

  it('never proposes the URL it was given', () => {
    expect(nixosCandidates(DEAD_NIXOS).map((c) => c.url)).not.toContain(DEAD_NIXOS)
  })

  // IGNORE half — this generator must stay silent on anything that is not a nixos channel ISO,
  // or every unrelated entry collects nonsense suggestions.
  it.each([
    ['a fedora qcow2', DEAD_FEDORA],
    ['an ubuntu image', 'https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img'],
    ['a nixos tarball, not the ISO pattern', 'https://channels.nixos.org/nixos-25.11/nixexprs.tar.xz'],
  ])('returns nothing for %s', (_label, url) => {
    expect(nixosCandidates(url)).toEqual([])
  })
})

describe('fedoraCandidates', () => {
  // Shaped exactly like the real releases.json, INCLUDING the archived F42 row that 404s. That
  // row is the point: the index advertises it, so ordering must not be mistaken for verification.
  const index = [
    { version: '42', variant: 'Cloud', arch: 'x86_64', link: DEAD_FEDORA },
    { version: '44', variant: 'Cloud', arch: 'x86_64', link: LIVE_FEDORA },
    { version: '44', variant: 'Cloud', arch: 'aarch64', link: LIVE_FEDORA.replace('x86_64', 'aarch64') },
    { version: '44', variant: 'Workstation', arch: 'x86_64', link: 'https://example.invalid/ws.iso' },
    {
      version: '44',
      variant: 'Cloud',
      arch: 'x86_64',
      link: 'https://download.fedoraproject.org/pub/fedora/linux/releases/44/Cloud/x86_64/images/Fedora-Cloud-Base-UEFI-UKI-44-1.7.x86_64.qcow2',
    },
  ]

  it('puts the newest release first', () => {
    expect(fedoraCandidates(index)[0]!.url).toBe(LIVE_FEDORA)
  })

  it('still lists the archived release rather than pretending the index is trustworthy', () => {
    expect(fedoraCandidates(index).map((c) => c.url)).toContain(DEAD_FEDORA)
  })

  it('filters to the requested arch', () => {
    for (const c of fedoraCandidates(index)) expect(c.url).not.toContain('aarch64')
  })

  it('excludes other variants and the UEFI-UKI image, which is not a drop-in', () => {
    const urls = fedoraCandidates(index).map((c) => c.url)
    expect(urls.some((u) => u.includes('Workstation') || u.includes('UEFI-UKI'))).toBe(false)
  })

  it('survives a garbage index instead of throwing', () => {
    for (const bad of [null, undefined, {}, 'nope', [null], [{ variant: 'Cloud' }]]) {
      expect(() => fedoraCandidates(bad)).not.toThrow()
    }
  })
})

describe('versionBumpCandidates', () => {
  it('bumps a bare path version segment', () => {
    expect(versionBumpCandidates('https://h/pub/9/img.qcow2', 1)[0]!.url).toBe('https://h/pub/10/img.qcow2')
  })

  // A filename version must NOT be bumped: Fedora-Cloud-Base-Generic-43-1.1 is not a name any
  // publisher created, and a plausible URL that 404s costs an admin a round trip to disprove.
  it('leaves a version embedded in a filename alone', () => {
    expect(versionBumpCandidates('https://h/images/Thing-42-1.1.x86_64.qcow2')).toEqual([])
  })
})

describe('resolveDistroUrl', () => {
  const probeWhere = (live: string[]): HeadProbe => async (u) => (live.includes(u) ? 200 : 404)

  it('keeps the recorded URL when it still works — a mirror hiccup must not rewrite the catalog', async () => {
    const r = await resolveDistroUrl(LIVE_NIXOS, nixosCandidates(LIVE_NIXOS), probeWhere([LIVE_NIXOS]))
    expect(r.resolved).toBe(LIVE_NIXOS)
    expect(r.strategy).toBe('as-recorded')
  })

  it('resolves the real nixos-desktop failure to the real fix', async () => {
    const r = await resolveDistroUrl(DEAD_NIXOS, nixosCandidates(DEAD_NIXOS), probeWhere([LIVE_NIXOS]))
    expect(r.resolved).toBe(LIVE_NIXOS)
    expect(r.strategy).toBe('nixos-variant-rename')
  })

  // THE CASE THE WHOLE MODULE EXISTS FOR. The index offers the archived URL; only verification
  // rejects it. A resolver that trusted the index would return a 404 with confidence.
  it('rejects an index-advertised URL that does not answer, and moves on', async () => {
    const cands = fedoraCandidates([
      { version: '44', variant: 'Cloud', arch: 'x86_64', link: LIVE_FEDORA },
      { version: '42', variant: 'Cloud', arch: 'x86_64', link: DEAD_FEDORA },
    ])
    const r = await resolveDistroUrl(DEAD_FEDORA, cands, probeWhere([LIVE_FEDORA]))
    expect(r.resolved).toBe(LIVE_FEDORA)
    expect(r.tried[0]).toMatchObject({ url: DEAD_FEDORA, status: 404 })
  })

  it('reports null rather than guessing when nothing answers', async () => {
    const r = await resolveDistroUrl(DEAD_NIXOS, nixosCandidates(DEAD_NIXOS), probeWhere([]))
    expect(r.resolved).toBeNull()
    expect(r.strategy).toBeNull()
    expect(r.tried.length).toBeGreaterThan(1)
  })

  it('records every attempt so a failure is diagnosable without a re-run', async () => {
    const r = await resolveDistroUrl(DEAD_NIXOS, nixosCandidates(DEAD_NIXOS), probeWhere([LIVE_NIXOS]))
    expect(r.tried.every((t) => typeof t.url === 'string' && t.strategy)).toBe(true)
  })

  it('probes each distinct URL once', async () => {
    const calls: string[] = []
    const probe: HeadProbe = async (u) => {
      calls.push(u)
      return 404
    }
    await resolveDistroUrl(DEAD_NIXOS, [...nixosCandidates(DEAD_NIXOS), ...nixosCandidates(DEAD_NIXOS)], probe)
    expect(calls.length).toBe(new Set(calls).size)
  })

  it('treats a probe error as a failure, not a pass', async () => {
    const r = await resolveDistroUrl(DEAD_NIXOS, [], async () => 'error')
    expect(r.resolved).toBeNull()
  })
})

describe('candidatesFor', () => {
  it('routes a nixos URL to the nixos generator', () => {
    expect(candidatesFor(DEAD_NIXOS).some((c) => c.strategy === 'nixos-variant-rename')).toBe(true)
  })

  it('uses the fedora index only when one was supplied', () => {
    expect(candidatesFor(DEAD_FEDORA).some((c) => c.strategy === 'fedora-index')).toBe(false)
    const withIndex = candidatesFor(DEAD_FEDORA, [
      { version: '44', variant: 'Cloud', arch: 'x86_64', link: LIVE_FEDORA },
    ])
    expect(withIndex.some((c) => c.strategy === 'fedora-index')).toBe(true)
  })

  // Dispatch keys on the HOST, never on a substring of the whole URL. A URL that merely
  // CONTAINS 'fedoraproject.org' — in its path, its query, or a lookalike domain — must not
  // reach the Fedora generator. `url.includes(...)` accepted all three of these until
  // 2026-08-21; CodeQL flagged it as js/incomplete-url-substring-sanitization, and the
  // security framing undersold it — it was a plain dispatch bug as well.
  it('does not route a lookalike or path-embedded host to a generator', () => {
    for (const hostile of [
      'https://evil.example/?ref=fedoraproject.org',
      'https://fedoraproject.org.evil.example/x.qcow2',
      'https://evil.example/fedoraproject.org/x.qcow2',
    ]) {
      const out = candidatesFor(hostile, [
        { version: '44', variant: 'Cloud', arch: 'x86_64', link: LIVE_FEDORA },
      ])
      expect(out.some((c) => c.strategy === 'fedora-index')).toBe(false)
    }
    expect(
      candidatesFor('https://notchannels.nixos.org.evil/x.iso').some(
        (c) => c.strategy === 'nixos-variant-rename'
      )
    ).toBe(false)
  })
})

describe('isHost', () => {
  it('matches the domain itself and its subdomains', () => {
    expect(isHost('https://fedoraproject.org/releases.json', 'fedoraproject.org')).toBe(true)
    expect(isHost('https://download.fedoraproject.org/pub/x.qcow2', 'fedoraproject.org')).toBe(true)
    expect(isHost('https://dl.fedoraproject.org/pub/archive/x.qcow2', 'fedoraproject.org')).toBe(true)
    expect(isHost(DEAD_NIXOS, 'channels.nixos.org')).toBe(true)
  })

  it('rejects the substring matches that the old check accepted', () => {
    expect(isHost('https://evil.example/?ref=fedoraproject.org', 'fedoraproject.org')).toBe(false)
    expect(isHost('https://fedoraproject.org.evil.example/x', 'fedoraproject.org')).toBe(false)
    expect(isHost('https://evil.example/fedoraproject.org/x', 'fedoraproject.org')).toBe(false)
    expect(isHost('https://notchannels.nixos.org.evil/x', 'channels.nixos.org')).toBe(false)
  })

  it('returns false rather than throwing on a value that is not a URL', () => {
    expect(isHost('not a url at all', 'fedoraproject.org')).toBe(false)
    expect(isHost('', 'fedoraproject.org')).toBe(false)
  })

  it('does not match an unrelated host', () => {
    expect(isHost('https://cloud-images.ubuntu.com/noble/current/x.img', 'fedoraproject.org')).toBe(false)
  })
})
