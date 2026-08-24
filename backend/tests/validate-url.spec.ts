// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// The SSRF guard.
//
// THIS FILE DID NOT EXIST UNTIL 2026-08-24, AND THAT IS THE FINDING (SEC-032).
//
// `validateExternalUrl` is the single control standing between four callers — the distro image
// downloader, the webhook adapter, the ntfy adapter and the remote catalog fetcher — and an
// outbound request to an address the caller supplied. It had no test of its own. `url-validator.
// spec.ts` covers a DIFFERENT function with a similar name (UrlValidationService, the distro URL
// health checker), and the guard was otherwise exercised only incidentally, through assertions
// about something else.
//
// The cost was two live bypasses that a single test would have caught:
//
//   1. `URL.hostname` returns an IPv6 literal WITH BRACKETS — `[fd00::1]`. The guard compared
//      `hostname.startsWith('fd')` and `startsWith('fe80')`, so both lines were dead from the day
//      they were written. They looked exactly like protection.
//   2. `::ffff:169.254.169.254` is the cloud metadata endpoint spelled as IPv6, and matched none
//      of the IPv4 prefixes.
//
// An auditor with no test only ever tells you it found nothing; it never tells you it cannot find
// anything. The same is true of a guard.
import { describe, it, expect } from 'vitest'
import { validateExternalUrl, expandIpv6, isBlockedIpv4, isBlockedIpv6 } from '../src/validate-url.js'

describe('validateExternalUrl — scheme', () => {
  it.each([
    ['file:///etc/passwd', 'local file read'],
    ['gopher://x.test/', 'gopher, the classic SSRF pivot'],
    ['ftp://x.test/', 'ftp'],
    ['data:text/plain,hi', 'data'],
  ])('rejects %s (%s)', (url) => {
    expect(() => validateExternalUrl(url)).toThrow(/only http\/https/)
  })

  it.each(['http://example.test/', 'https://example.test/'])('accepts %s', (url) => {
    expect(() => validateExternalUrl(url)).not.toThrow()
  })
})

describe('validateExternalUrl — MUST BLOCK', () => {
  describe('IPv4', () => {
    it.each([
      ['http://127.0.0.1/', 'loopback'],
      ['http://127.1/', 'loopback shorthand'],
      ['http://0.0.0.0/', '0.0.0.0/8 — "this host"'],
      ['http://10.0.0.1/', 'RFC1918 10/8'],
      ['http://172.16.0.1/', 'RFC1918 172.16/12 lower bound'],
      ['http://172.31.255.254/', 'RFC1918 172.16/12 upper bound'],
      ['http://192.168.1.1/', 'RFC1918 192.168/16'],
      ['http://100.64.0.1/', 'RFC6598 CGNAT'],
      ['http://169.254.169.254/', 'cloud metadata'],
      ['http://224.0.0.1/', 'multicast'],
    ])('blocks %s (%s)', (url) => {
      expect(() => validateExternalUrl(url)).toThrow()
    })

    // These are blocked because the WHATWG URL parser canonicalises them before the guard runs
    // (`0x7f000001` -> `127.0.0.1`), NOT because the guard understands them. That is a property of
    // a dependency, so it is pinned here — a parser change would otherwise reopen them silently.
    it.each([
      ['http://0x7f000001/', 'hex loopback'],
      ['http://2130706433/', 'decimal loopback'],
      ['http://0177.0.0.1/', 'octal loopback'],
      ['http://0xA9FEA9FE/', 'hex cloud metadata'],
      ['http://2852039166/', 'decimal cloud metadata'],
    ])('blocks %s (%s) — via parser canonicalisation', (url) => {
      expect(() => validateExternalUrl(url)).toThrow()
    })
  })

  describe('IPv6 — the class the previous implementation could not see', () => {
    it.each([
      ['http://[::1]/', 'loopback, the literal the old guard hardcoded'],
      ['http://[0:0:0:0:0:0:0:1]/', 'loopback, expanded — same address, different text'],
      ['http://[::]/', 'unspecified; routes to localhost on a dual-stack host'],
      ['http://[fd00::1]/', 'unique-local — the fd:: half the old check aimed at and missed'],
      ['http://[fc00::1]/', 'unique-local — the fc:: half it did not aim at'],
      ['http://[FD00::1]/', 'unique-local, uppercase'],
      ['http://[fe80::1]/', 'link-local'],
      ['http://[fe80::1%25eth0]/', 'link-local carrying a zone id'],
      ['http://[ff02::1]/', 'multicast all-nodes'],
    ])('blocks %s (%s)', (url) => {
      expect(() => validateExternalUrl(url)).toThrow()
    })

    it.each([
      ['http://[::ffff:127.0.0.1]/', 'IPv4-mapped loopback'],
      ['http://[::ffff:10.0.0.1]/', 'IPv4-mapped RFC1918'],
      ['http://[::ffff:192.168.1.1]/', 'IPv4-mapped home LAN'],
      ['http://[::ffff:169.254.169.254]/', 'IPv4-mapped CLOUD METADATA — the one that matters'],
      ['http://[::127.0.0.1]/', 'IPv4-compatible loopback'],
      ['http://[64:ff9b::169.254.169.254]/', 'NAT64 well-known prefix with metadata behind it'],
    ])('blocks %s (%s) — an IPv4 rule must not be optional', (url) => {
      expect(() => validateExternalUrl(url)).toThrow()
    })
  })

  describe('names', () => {
    it.each([
      ['http://localhost/', 'the name itself'],
      ['http://LOCALHOST/', 'uppercase'],
      ['http://anything.localhost/', 'RFC6761 reserves the whole TLD to loopback'],
    ])('blocks %s (%s)', (url) => {
      expect(() => validateExternalUrl(url)).toThrow()
    })
  })
})

describe('validateExternalUrl — MUST ALLOW', () => {
  // The half that keeps the guard alive. One that refuses everything breaks image mirrors on a
  // v6-only host and becomes the first thing removed — after which it catches nothing at all.
  it.each([
    ['https://example.test/mirror.qcow2', 'an ordinary name'],
    ['http://93.184.216.34/', 'an ordinary public literal'],
    ['http://[2001:db8::1]/', 'public IPv6 shape'],
    ['https://[2606:4700::1111]/', 'a real public resolver'],
    ['http://[::ffff:93.184.216.34]/', 'IPv4-mapped PUBLIC — the mapping is not the offence'],
    ['https://cdn.example.test:8443/path?q=1', 'port and query preserved'],
    ['http://172.15.0.1/', 'just below RFC1918 172.16/12'],
    ['http://172.32.0.1/', 'just above RFC1918 172.16/12'],
    ['http://100.63.0.1/', 'just below CGNAT 100.64/10'],
    ['http://100.128.0.1/', 'just above CGNAT 100.64/10'],
    ['http://11.0.0.1/', 'adjacent to 10/8'],
    ['http://192.169.0.1/', 'adjacent to 192.168/16'],
    ['http://169.253.0.1/', 'adjacent to link-local'],
    ['http://223.255.255.255/', 'last address below multicast'],
    ['http://localhost.example.test/', 'a name that merely CONTAINS localhost'],
  ])('allows %s (%s)', (url) => {
    expect(() => validateExternalUrl(url)).not.toThrow()
  })

  it('returns the parsed URL, not a boolean', () => {
    const u = validateExternalUrl('https://cdn.example.test:8443/a/b.qcow2?v=2')
    expect(u.hostname).toBe('cdn.example.test')
    expect(u.port).toBe('8443')
    expect(u.pathname).toBe('/a/b.qcow2')
  })
})

describe('expandIpv6 — the parser the classifier rests on', () => {
  it('expands compression to eight groups', () => {
    expect(expandIpv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1])
    expect(expandIpv6('fd00::1')).toEqual([0xfd00, 0, 0, 0, 0, 0, 0, 1])
    expect(expandIpv6('::')).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('strips brackets, because that is the bug this whole finding is about', () => {
    expect(expandIpv6('[fd00::1]')).toEqual(expandIpv6('fd00::1'))
  })

  it('folds a trailing dotted-quad into two hex groups', () => {
    expect(expandIpv6('::ffff:10.0.0.1')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x0a00, 0x0001])
  })

  it('returns null rather than a partial answer on garbage', () => {
    // A partial answer would be classified, and misclassified. null forces the caller to treat the
    // value as "not an IPv6 address" instead of guessing at it.
    for (const bad of ['fd00::1::2', 'nonsense', 'fd00:::1', '1:2:3:4:5:6:7', '::ffff:999.1.1.1', 'gggg::1']) {
      expect(expandIpv6(bad), bad).toBeNull()
    }
  })
})

describe('the pure classifiers', () => {
  it('isBlockedIpv4 refuses a malformed quad rather than throwing', () => {
    // It is a predicate on the deny path, so an exception here would become a 500 on a route that
    // should have returned a validation error.
    expect(isBlockedIpv4('999.1.1.1')).toBe(false)
    expect(isBlockedIpv4('not-an-ip')).toBe(false)
  })

  it('isBlockedIpv6 treats an unparseable address as not-blocked, leaving the caller to reject it', () => {
    expect(isBlockedIpv6('nonsense')).toBe(false)
  })
})
