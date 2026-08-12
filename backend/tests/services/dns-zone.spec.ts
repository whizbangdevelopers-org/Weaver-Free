// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// DNS Core zone generation.
//
// A name service fails differently from the rest of the product. A wrong record does not error —
// it RESOLVES, to the wrong machine, and the caller proceeds confidently against it. So the cases
// that matter here are the ones where a plausible zone is produced from bad input: duplicate
// names, duplicate addresses, and anything that would put a record in the file that should not be
// there.
import { describe, it, expect } from 'vitest'
import {
  buildZone,
  renderHostsFile,
  zoneContentEquals,
  reverseName,
  isIpv4,
  DEFAULT_DNS_DOMAIN,
  DEFAULT_DNS_TTL,
} from '../../src/services/dns-zone.js'

const A = (z: ReturnType<typeof buildZone>) => z.records.filter(r => r.type === 'A')
const PTR = (z: ReturnType<typeof buildZone>) => z.records.filter(r => r.type === 'PTR')

describe('the zone domain', () => {
  it('defaults to .vm.internal, never .local', () => {
    // .local is reserved for mDNS (RFC 6762). A .vm.local zone collides with Avahi on exactly the
    // home-lab networks this targets, and the symptom is intermittent host-dependent resolution
    // failure. The plan settled this; its own examples disagreed for a while.
    expect(DEFAULT_DNS_DOMAIN).toBe('vm.internal')
    expect(DEFAULT_DNS_DOMAIN.endsWith('.local')).toBe(false)

    const zone = buildZone([{ name: 'web', ip: '10.10.0.10' }], { serial: 1 })
    expect(A(zone)[0]!.name).toBe('web.vm.internal')
  })

  it('has a low default TTL, because workloads are short-lived', () => {
    // A stale A record outlives its VM. 60s bounds how long a destroyed workload keeps resolving.
    expect(DEFAULT_DNS_TTL).toBe(60)
  })

  it('honours an explicit domain', () => {
    const zone = buildZone([{ name: 'web', ip: '10.10.0.10' }], { domain: 'lab.example', serial: 1 })
    expect(A(zone)[0]!.name).toBe('web.lab.example')
  })
})

describe('isIpv4', () => {
  it('accepts real addresses', () => {
    expect(isIpv4('10.10.0.10')).toBe(true)
    expect(isIpv4('0.0.0.0')).toBe(true)
    expect(isIpv4('255.255.255.255')).toBe(true)
  })

  it('rejects out-of-range octets', () => {
    expect(isIpv4('10.10.0.256')).toBe(false)
    expect(isIpv4('999.1.1.1')).toBe(false)
  })

  it('rejects the wrong shape', () => {
    expect(isIpv4('10.10.0')).toBe(false)
    expect(isIpv4('10.10.0.10.5')).toBe(false)
    expect(isIpv4('')).toBe(false)
    expect(isIpv4('not-an-ip')).toBe(false)
  })

  it('rejects leading zeros, which some resolvers read as octal', () => {
    // 010.10.0.10 is 8.10.0.10 under an octal reading. A loose \d+ regex accepts it.
    expect(isIpv4('010.10.0.10')).toBe(false)
  })
})

describe('reverseName', () => {
  it('builds the in-addr.arpa name', () => {
    expect(reverseName('10.10.0.10')).toBe('10.0.10.10.in-addr.arpa')
  })
})

describe('buildZone', () => {
  it('emits a forward and a reverse record per workload', () => {
    const zone = buildZone([{ name: 'web-nginx', ip: '10.10.0.10' }], { serial: 7 })
    expect(zone.serial).toBe(7)
    expect(A(zone)).toEqual([
      { name: 'web-nginx.vm.internal', type: 'A', value: '10.10.0.10', vmName: 'web-nginx' },
    ])
    expect(PTR(zone)).toEqual([
      { name: '10.0.10.10.in-addr.arpa', type: 'PTR', value: 'web-nginx.vm.internal', vmName: 'web-nginx' },
    ])
    expect(zone.skipped).toEqual([])
  })

  it('handles an empty registry', () => {
    const zone = buildZone([], { serial: 1 })
    expect(zone.records).toEqual([])
    expect(zone.skipped).toEqual([])
  })

  describe('exclusions are recorded, never silent', () => {
    it('skips a workload with no address', () => {
      // A container on an unmanaged bridge has nothing to publish. Emitting a record with an
      // empty value would create a name that resolves to nothing.
      const zone = buildZone([{ name: 'ghost' }], { serial: 1 })
      expect(zone.records).toEqual([])
      expect(zone.skipped).toEqual([{ name: 'ghost', reason: 'no IPv4 address' }])
    })

    it('skips a malformed address rather than publishing it', () => {
      const zone = buildZone([{ name: 'bad', ip: '10.10.0.999' }], { serial: 1 })
      expect(zone.records).toEqual([])
      expect(zone.skipped[0]!.reason).toBe('no IPv4 address')
    })

    it('skips a name that is not a valid DNS label', () => {
      const zone = buildZone([{ name: 'Not_A_Label', ip: '10.10.0.5' }], { serial: 1 })
      expect(zone.records).toEqual([])
      expect(zone.skipped[0]!.reason).toBe('name is not a valid DNS label')
    })

    it('rejects a name that starts or ends with a hyphen', () => {
      const zone = buildZone([
        { name: '-lead', ip: '10.10.0.5' },
        { name: 'trail-', ip: '10.10.0.6' },
      ], { serial: 1 })
      expect(zone.records).toEqual([])
      expect(zone.skipped).toHaveLength(2)
    })
  })

  // --- the cases where a wrong zone still resolves ---

  describe('duplicate names', () => {
    it('keeps the first and records the second as skipped', () => {
      // Two A records for one name is the failure where resolution WORKS and points at the wrong
      // machine — strictly worse than not resolving, because nothing surfaces as an error.
      const zone = buildZone([
        { name: 'web', ip: '10.10.0.10' },
        { name: 'web', ip: '10.10.0.99' },
      ], { serial: 1 })

      expect(A(zone)).toHaveLength(1)
      expect(A(zone)[0]!.value).toBe('10.10.0.10')
      expect(zone.skipped).toEqual([{ name: 'web', reason: 'duplicate name' }])
    })
  })

  describe('duplicate addresses', () => {
    it('keeps BOTH forward records but only the first reverse', () => {
      // Two names legitimately sharing an address is not an error — the forward records are both
      // correct and both must work. Only the PTR is ambiguous, so only the PTR is withheld.
      // Dropping the second A record would break working forward resolution in order to resolve a
      // reverse-lookup ambiguity nobody asked about.
      const zone = buildZone([
        { name: 'web', ip: '10.10.0.10' },
        { name: 'web-alias', ip: '10.10.0.10' },
      ], { serial: 1 })

      expect(A(zone).map(r => r.name)).toEqual(['web.vm.internal', 'web-alias.vm.internal'])
      expect(PTR(zone)).toHaveLength(1)
      expect(PTR(zone)[0]!.value).toBe('web.vm.internal')
      expect(zone.skipped[0]!.reason).toContain('duplicate address')
    })
  })

  it('keeps going after a skip', () => {
    // One bad entry must not truncate the zone — a resolver serving three of five workloads is
    // harder to notice than one serving none.
    const zone = buildZone([
      { name: 'good-one', ip: '10.10.0.1' },
      { name: 'Bad_Name', ip: '10.10.0.2' },
      { name: 'good-two', ip: '10.10.0.3' },
    ], { serial: 1 })
    expect(A(zone).map(r => r.vmName)).toEqual(['good-one', 'good-two'])
    expect(zone.skipped).toHaveLength(1)
  })
})

describe('renderHostsFile', () => {
  it('emits FQDN and short name per address', () => {
    const zone = buildZone([{ name: 'web', ip: '10.10.0.10' }], { serial: 3 })
    const out = renderHostsFile(zone)
    expect(out).toContain('10.10.0.10\tweb.vm.internal\tweb')
  })

  it('carries a do-not-edit header naming the source', () => {
    // The file is regenerated wholesale, so a hand edit is lost. Saying so in the file is the
    // only place a person editing it will look.
    const out = renderHostsFile(buildZone([], { serial: 1 }))
    expect(out).toContain('DO NOT EDIT')
    expect(out).toContain('workload registry')
    expect(out).toContain('serial=1')
  })

  it('writes no line for a PTR — dnsmasq derives the reverse from the forward entry', () => {
    // The hosts format cannot express a forward record whose reverse disagrees with it. A BIND
    // zone file can, and that inconsistency is invisible until someone runs a reverse lookup.
    const zone = buildZone([{ name: 'web', ip: '10.10.0.10' }], { serial: 1 })
    const lines = renderHostsFile(zone).split('\n').filter(l => l && !l.startsWith('#'))
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toContain('in-addr.arpa')
  })

  it('renders an empty zone as header-only', () => {
    const lines = renderHostsFile(buildZone([], { serial: 1 })).split('\n').filter(l => l && !l.startsWith('#'))
    expect(lines).toEqual([])
  })
})

describe('zoneContentEquals', () => {
  const zoneOf = (workloads: { name: string; ip?: string }[], serial: number) =>
    buildZone(workloads, { serial })

  it('ignores the serial', () => {
    // The serial is derived FROM the answer. Comparing it would report a change on every tick and
    // the resolver would reload continuously.
    expect(zoneContentEquals(
      zoneOf([{ name: 'web', ip: '10.10.0.10' }], 1),
      zoneOf([{ name: 'web', ip: '10.10.0.10' }], 999),
    )).toBe(true)
  })

  it('detects a changed address', () => {
    expect(zoneContentEquals(
      zoneOf([{ name: 'web', ip: '10.10.0.10' }], 1),
      zoneOf([{ name: 'web', ip: '10.10.0.11' }], 1),
    )).toBe(false)
  })

  it('detects an added workload', () => {
    expect(zoneContentEquals(
      zoneOf([{ name: 'web', ip: '10.10.0.10' }], 1),
      zoneOf([{ name: 'web', ip: '10.10.0.10' }, { name: 'db', ip: '10.10.0.20' }], 1),
    )).toBe(false)
  })

  it('is order-independent', () => {
    // The registry does not guarantee ordering, and a reload triggered by a re-sort would be a
    // resolver restart for no reason.
    expect(zoneContentEquals(
      zoneOf([{ name: 'web', ip: '10.10.0.10' }, { name: 'db', ip: '10.10.0.20' }], 1),
      zoneOf([{ name: 'db', ip: '10.10.0.20' }, { name: 'web', ip: '10.10.0.10' }], 1),
    )).toBe(true)
  })

  it('detects a domain change', () => {
    expect(zoneContentEquals(
      buildZone([{ name: 'web', ip: '10.10.0.10' }], { serial: 1 }),
      buildZone([{ name: 'web', ip: '10.10.0.10' }], { serial: 1, domain: 'other.internal' }),
    )).toBe(false)
  })
})
