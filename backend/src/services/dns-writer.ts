// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { buildZone, renderHostsFile, zoneContentEquals, type DnsZone } from './dns-zone.js'

/**
 * Writes the generated zone to disk and asks the resolver to reload it.
 *
 * The filesystem and the reload are injected — the whole point of the class is what it does
 * ACROSS calls (skip an unchanged zone, advance the serial only on a real change, survive a
 * failed reload) and none of that is reachable in a test that needs a real dnsmasq.
 */
export interface DnsWriterDeps {
  /** Write a file atomically. Must not leave a partial file readable at `path`. */
  writeFile: (path: string, content: string) => Promise<void>
  /** Ask the resolver to re-read its hosts file. Rejects if the signal fails. */
  reload: () => Promise<void>
  now?: () => number
}

export interface DnsWriteResult {
  changed: boolean
  serial: number
  /** False when the zone changed on disk but the resolver did not pick it up. */
  reloaded: boolean
  skipped: DnsZone['skipped']
}

export class DnsZoneWriter {
  private lastZone: DnsZone | null = null
  private serial = 0

  constructor(
    private readonly deps: DnsWriterDeps,
    private readonly opts: { hostsPath: string; domain?: string; ttl?: number },
  ) {}

  get currentZone(): DnsZone | null {
    return this.lastZone
  }

  /**
   * Regenerate from a registry snapshot and publish if anything actually changed.
   *
   * Two orderings matter here and both are the opposite of the obvious one:
   *
   * 1. **Compare before incrementing the serial.** The serial is derived from the answer, so
   *    bumping it first makes every comparison report a change and the resolver reloads on every
   *    tick — for a service polled continuously, that is a reload storm that looks like nothing at
   *    all from the outside.
   *
   * 2. **Write, then reload; and keep the zone recorded even if the reload fails.** The file on
   *    disk IS the new state whether or not dnsmasq acknowledged it. Rolling `lastZone` back on a
   *    failed reload would make the next call see a change that has already been written, rewrite
   *    the identical file, and try again forever. Reporting `reloaded: false` lets the caller
   *    retry the *signal* without redoing the write.
   */
  async sync(workloads: { name: string; ip?: string }[]): Promise<DnsWriteResult> {
    const candidate = buildZone(workloads, {
      domain: this.opts.domain,
      ttl: this.opts.ttl,
      serial: this.serial,
    })

    if (this.lastZone && zoneContentEquals(this.lastZone, candidate)) {
      return { changed: false, serial: this.serial, reloaded: true, skipped: candidate.skipped }
    }

    this.serial += 1
    const zone: DnsZone = { ...candidate, serial: this.serial }

    await this.deps.writeFile(this.opts.hostsPath, renderHostsFile(zone))
    // Recorded BEFORE the reload — see (2) above. The disk is the state.
    this.lastZone = zone

    let reloaded = true
    try {
      await this.deps.reload()
    } catch {
      // Never rethrown: a resolver that will not reload is an operational problem, not a reason
      // to fail the workload operation that triggered this. The caller sees reloaded:false.
      reloaded = false
    }

    return { changed: true, serial: this.serial, reloaded, skipped: zone.skipped }
  }
}
