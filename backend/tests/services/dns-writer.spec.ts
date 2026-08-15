// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// The DNS zone writer — the stateful half.
//
// Everything worth testing here is a property ACROSS calls, and each one has a failure mode that
// produces no error at all: a reload storm that looks like idle, a serial that never advances, or
// a write loop that rewrites an identical file forever. None of it is reachable through a real
// dnsmasq, which is why both the filesystem and the reload signal are injected.
import { describe, it, expect, vi } from 'vitest'
import { DnsZoneWriter, retireZone } from '../../src/services/dns-writer.js'

function makeWriter(opts: { reloadFails?: boolean } = {}) {
  const writes: { path: string; content: string }[] = []
  const reload = vi.fn(async () => {
    if (opts.reloadFails) throw new Error('systemctl: unit not found')
  })
  const writeFile = vi.fn(async (path: string, content: string) => {
    writes.push({ path, content })
  })
  const writer = new DnsZoneWriter({ writeFile, reload }, { hostsPath: '/tmp/weaver-hosts' })
  return { writer, writes, reload, writeFile }
}

const WEB = { name: 'web', ip: '10.10.0.10' }
const DB = { name: 'db', ip: '10.10.0.20' }

describe('DnsZoneWriter', () => {
  it('writes and reloads on the first sync', async () => {
    const { writer, writes, reload } = makeWriter()
    const result = await writer.sync([WEB])

    expect(result.changed).toBe(true)
    expect(result.serial).toBe(1)
    expect(result.reloaded).toBe(true)
    expect(writes).toHaveLength(1)
    expect(writes[0]!.path).toBe('/tmp/weaver-hosts')
    expect(writes[0]!.content).toContain('10.10.0.10\tweb.vm.internal\tweb')
    expect(reload).toHaveBeenCalledOnce()
  })

  // --- the reload-storm case ---

  it('does NOT write or reload when nothing changed', async () => {
    const { writer, writeFile, reload } = makeWriter()
    await writer.sync([WEB])
    const second = await writer.sync([WEB])

    // The registry is polled continuously. Rewriting and reloading on every tick is a reload
    // storm that presents, from the outside, as a resolver that is simply always busy.
    expect(second.changed).toBe(false)
    expect(second.serial).toBe(1)
    expect(writeFile).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('holds the serial steady across unchanged syncs', async () => {
    const { writer } = makeWriter()
    await writer.sync([WEB])
    for (let i = 0; i < 5; i++) await writer.sync([WEB])
    expect(writer.currentZone!.serial).toBe(1)
  })

  it('is not fooled by workload ordering', async () => {
    // The registry gives no ordering guarantee. A re-sort is not a reason to restart a resolver.
    const { writer, writeFile } = makeWriter()
    await writer.sync([WEB, DB])
    const second = await writer.sync([DB, WEB])
    expect(second.changed).toBe(false)
    expect(writeFile).toHaveBeenCalledOnce()
  })

  // --- real changes ---

  it('advances the serial and rewrites when a workload is added', async () => {
    const { writer, writeFile } = makeWriter()
    await writer.sync([WEB])
    const second = await writer.sync([WEB, DB])

    expect(second.changed).toBe(true)
    expect(second.serial).toBe(2)
    expect(writeFile).toHaveBeenCalledTimes(2)
    expect(writeFile.mock.calls[1]![1]).toContain('db.vm.internal')
  })

  it('rewrites when a workload is removed', async () => {
    const { writer, writeFile } = makeWriter()
    await writer.sync([WEB, DB])
    const second = await writer.sync([WEB])

    expect(second.changed).toBe(true)
    expect(writeFile.mock.calls[1]![1]).not.toContain('db.vm.internal')
  })

  it('rewrites when an address changes', async () => {
    // The case a name-based comparison would miss entirely, leaving the zone pointing at the old
    // address — resolution keeps working and keeps being wrong.
    const { writer, writeFile } = makeWriter()
    await writer.sync([WEB])
    const second = await writer.sync([{ name: 'web', ip: '10.10.0.99' }])

    expect(second.changed).toBe(true)
    expect(writeFile.mock.calls[1]![1]).toContain('10.10.0.99')
  })

  // --- the failed-reload case ---

  describe('when the resolver will not reload', () => {
    it('reports reloaded:false without throwing', async () => {
      // A resolver that will not reload is an operational problem, not a reason to fail the
      // workload operation that triggered the sync.
      const { writer } = makeWriter({ reloadFails: true })
      const result = await writer.sync([WEB])
      expect(result.changed).toBe(true)
      expect(result.reloaded).toBe(false)
    })

    it('still records the zone, so the next sync does not rewrite the same file forever', async () => {
      // The file on disk IS the new state whether or not dnsmasq acknowledged it. Rolling back
      // `lastZone` on a failed reload makes the next call see a change that has already been
      // written, rewrite the identical file, fail the reload again — indefinitely.
      const { writer, writeFile } = makeWriter({ reloadFails: true })
      await writer.sync([WEB])
      const second = await writer.sync([WEB])

      expect(second.changed).toBe(false)
      expect(writeFile).toHaveBeenCalledOnce()
    })

    it('lets a later successful reload happen without a redundant write', async () => {
      const writes: string[] = []
      let failing = true
      const writer = new DnsZoneWriter(
        {
          writeFile: async (_p, c) => { writes.push(c) },
          reload: async () => { if (failing) throw new Error('down') },
        },
        { hostsPath: '/tmp/h' },
      )
      await writer.sync([WEB])
      failing = false
      await writer.sync([WEB, DB]) // a real change, and now the reload works
      expect(writes).toHaveLength(2)
    })
  })

  it('propagates a write failure — the disk is the state, so a failed write is fatal', async () => {
    // Unlike the reload, a failed WRITE means there is no new state at all. Swallowing it would
    // record a zone that was never persisted, and the next sync would report no change.
    const writer = new DnsZoneWriter(
      { writeFile: async () => { throw new Error('EACCES') }, reload: async () => {} },
      { hostsPath: '/tmp/h' },
    )
    await expect(writer.sync([WEB])).rejects.toThrow('EACCES')
    expect(writer.currentZone).toBeNull()
  })

  it('surfaces skipped workloads so a missing record is explainable', async () => {
    const { writer } = makeWriter()
    const result = await writer.sync([WEB, { name: 'ghost' }])
    expect(result.skipped).toEqual([{ name: 'ghost', reason: 'no IPv4 address' }])
  })

  it('reports skips on an unchanged sync too', async () => {
    // Otherwise the reason a workload is missing appears once and then vanishes, and whoever
    // looks second sees an unexplained gap.
    const { writer } = makeWriter()
    await writer.sync([WEB, { name: 'ghost' }])
    const second = await writer.sync([WEB, { name: 'ghost' }])
    expect(second.changed).toBe(false)
    expect(second.skipped).toHaveLength(1)
  })

  it('honours a custom domain', async () => {
    const writes: string[] = []
    const writer = new DnsZoneWriter(
      { writeFile: async (_p, c) => { writes.push(c) }, reload: async () => {} },
      { hostsPath: '/tmp/h', domain: 'lab.example' },
    )
    await writer.sync([WEB])
    expect(writes[0]).toContain('web.lab.example')
  })
})

/**
 * Zone retirement — what a Free host does about a zone an earlier licence published.
 *
 * The behaviour exists because `weaver-dnsmasq` is gated on `services.weaver.dns.enable`, the
 * option rather than the tier. When a licence lapses the backend stops maintaining the file and
 * dnsmasq carries on answering from it, so the records outlive the entitlement indefinitely.
 *
 * Every case below is one where the obvious implementation is silently wrong: deleting the file
 * breaks dnsmasq's next start, skipping the reload leaves the withdrawn names resolving until
 * something restarts, and writing unconditionally signals the resolver on every Free boot forever.
 */
describe('retireZone', () => {
  function makeFs(initial: Record<string, string>, opts: { reloadFails?: boolean } = {}) {
    const files = { ...initial }
    const reload = vi.fn(async () => {
      if (opts.reloadFails) throw new Error('systemctl: unit not found')
    })
    const writeFile = vi.fn(async (path: string, content: string) => { files[path] = content })
    const readFile = vi.fn(async (path: string) => files[path] ?? null)
    return { deps: { writeFile, reload, readFile }, files, reload, writeFile }
  }

  const PATH = '/var/lib/weaver/dns-hosts'
  const PUBLISHED = [
    '# Generated by Weaver — DO NOT EDIT.',
    '# domain=vm.internal serial=7 ttl=60',
    '',
    '10.10.0.10\tweb.vm.internal\tweb',
    '',
  ].join('\n')

  it('withdraws the records from a published zone', async () => {
    const { deps, files } = makeFs({ [PATH]: PUBLISHED })
    const result = await retireZone(deps, PATH)

    expect(result.retired).toBe(true)
    expect(files[PATH]).not.toContain('web.vm.internal')
    expect(files[PATH]).not.toContain('10.10.0.10')
  })

  it('EMPTIES the file rather than deleting it', async () => {
    // dnsmasq refuses to start on a missing addn-hosts — the NixOS module creates this path with
    // systemd-tmpfiles for exactly that reason. Removing it would trade a stale zone for a
    // resolver that never comes back after a reboot, which is the worse of the two failures and
    // the one an operator meets at the least convenient moment.
    const { deps, files } = makeFs({ [PATH]: PUBLISHED })
    await retireZone(deps, PATH)

    expect(PATH in files).toBe(true)
    expect(typeof files[PATH]).toBe('string')
  })

  it('leaves the file explaining itself', async () => {
    // Someone will open this before they read any docs. A zero-byte file says nothing; a banner
    // names the cause and the remedy.
    const { deps, files } = makeFs({ [PATH]: PUBLISHED })
    await retireZone(deps, PATH)

    expect(files[PATH]).toContain('ZONE RETIRED')
    expect(files[PATH]).toContain('Solo')
  })

  it('signals the resolver — emptying the file is not enough on its own', async () => {
    // A running dnsmasq answers from the copy it read at start-up. Without the reload the
    // withdrawn names keep resolving, which is the exact condition this function exists to end.
    const { deps, reload } = makeFs({ [PATH]: PUBLISHED })
    const result = await retireZone(deps, PATH)

    expect(reload).toHaveBeenCalledTimes(1)
    expect(result.reloaded).toBe(true)
  })

  it('reports a failed reload without throwing', async () => {
    // Same tolerance as sync: the disk is the state, and a resolver that will not reload is an
    // operational problem rather than a reason to fail start-up.
    const { deps, files } = makeFs({ [PATH]: PUBLISHED }, { reloadFails: true })
    const result = await retireZone(deps, PATH)

    expect(result.retired).toBe(true)
    expect(result.reloaded).toBe(false)
    expect(files[PATH]).toContain('ZONE RETIRED')
  })

  it('does NOTHING when there is no zone file — a Free host that never had one', async () => {
    // The common case by far. Creating a file here would put a Weaver artefact on every Free
    // install that has never used DNS Core.
    const { deps, files, writeFile, reload } = makeFs({})
    const result = await retireZone(deps, PATH)

    expect(result.retired).toBe(false)
    expect(writeFile).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    expect(PATH in files).toBe(false)
  })

  it('is idempotent — a second boot neither rewrites nor re-signals', async () => {
    // This runs at every start-up on a lapsed host. Without the banner check it would rewrite the
    // file and SIGHUP dnsmasq on every boot, forever, for a zone that is already withdrawn.
    const { deps, writeFile, reload } = makeFs({ [PATH]: PUBLISHED })
    await retireZone(deps, PATH)
    expect(writeFile).toHaveBeenCalledTimes(1)

    const second = await retireZone(deps, PATH)
    expect(second.retired).toBe(false)
    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('retires a zone whose records are gone but whose banner is the published one', async () => {
    // An empty PUBLISHED zone is not a retired one: it still claims to be a maintained file, so a
    // reader cannot tell that Weaver has stopped touching it. The banner is the marker, never the
    // record count.
    const emptyPublished = [
      '# Generated by Weaver — DO NOT EDIT.',
      '# domain=vm.internal serial=3 ttl=60',
      '',
      '',
    ].join('\n')
    const { deps, files } = makeFs({ [PATH]: emptyPublished })
    const result = await retireZone(deps, PATH)

    expect(result.retired).toBe(true)
    expect(files[PATH]).toContain('ZONE RETIRED')
  })
})
