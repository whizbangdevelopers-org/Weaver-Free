// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * DNS Core — the `.vm.internal` auto-zone, derived from the workload registry.
 *
 * Pure: a registry snapshot in, a zone and a dnsmasq hosts file out. Nothing here reads a file,
 * spawns a process or signals a resolver; that belongs to the writer, and keeping it out means
 * every case below is testable without a resolver on the box.
 *
 * **The domain is `.vm.internal`, never `.local`.** `.local` is reserved for mDNS by RFC 6762, so
 * a `.vm.local` zone collides with Avahi/Bonjour on precisely the home-lab networks this feature
 * targets — the symptom is intermittent, host-dependent resolution failure, which is close to the
 * worst diagnostic experience a name service can offer. The plan settled this explicitly; its own
 * examples used `.vm.local` for a while, which is why this is stated here next to the code rather
 * than left in a document.
 */

/** A generated record. Only the types DNS Core emits — the resolver extension adds SRV/CNAME. */
export interface DnsRecord {
  name: string
  type: 'A' | 'PTR'
  value: string
  vmName: string
}

export interface DnsZone {
  domain: string
  ttl: number
  serial: number
  records: DnsRecord[]
  /** Workloads deliberately excluded, with the reason. Surfaced so a gap is explainable. */
  skipped: { name: string; reason: string }[]
}

/** Default zone domain. Configurable, but never `.local` — see the file header. */
export const DEFAULT_DNS_DOMAIN = 'vm.internal'

/** Low by design: workloads come and go, and a stale A record outlives its VM. */
export const DEFAULT_DNS_TTL = 60

/** A label must be a valid DNS label (RFC 1123) — the registry's name rule is stricter already. */
const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

/** Dotted-quad, each octet 0-255. Deliberately not a loose `\d+\.\d+\.\d+\.\d+`. */
export function isIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255 && String(Number(p)) === p)
}

/** `10.10.0.10` → `10.0.10.10.in-addr.arpa`. */
export function reverseName(ip: string): string {
  return `${ip.split('.').reverse().join('.')}.in-addr.arpa`
}

/**
 * Build the zone from a registry snapshot.
 *
 * `serial` is supplied by the caller rather than read from a clock, so the function stays pure and
 * a test can assert the whole zone instead of everything-but-one-field.
 *
 * Workloads are SKIPPED rather than silently dropped, each with a reason:
 *
 *  - **no address** — a container on a bridge Weaver does not manage has no address to publish.
 *  - **invalid name** — cannot be a DNS label.
 *  - **duplicate name** — first wins. Two records for one name is the failure mode where
 *    resolution works and points at the wrong machine, which is worse than not resolving.
 *  - **duplicate address** — the *reverse* record is what collides here. Two PTRs for one IP make
 *    reverse lookups non-deterministic, so the forward A record is kept (both names still
 *    resolve) and only the second PTR is dropped. Dropping both A records instead would break
 *    working forward resolution to fix a reverse-lookup ambiguity nobody asked about.
 */
export function buildZone(
  workloads: { name: string; ip?: string }[],
  opts: { domain?: string; ttl?: number; serial: number },
): DnsZone {
  const domain = opts.domain ?? DEFAULT_DNS_DOMAIN
  const ttl = opts.ttl ?? DEFAULT_DNS_TTL
  const records: DnsRecord[] = []
  const skipped: { name: string; reason: string }[] = []

  const seenNames = new Set<string>()
  const seenIps = new Set<string>()

  for (const w of workloads) {
    if (!LABEL_RE.test(w.name)) {
      skipped.push({ name: w.name, reason: 'name is not a valid DNS label' })
      continue
    }
    if (!w.ip || !isIpv4(w.ip)) {
      skipped.push({ name: w.name, reason: 'no IPv4 address' })
      continue
    }
    if (seenNames.has(w.name)) {
      skipped.push({ name: w.name, reason: 'duplicate name' })
      continue
    }
    seenNames.add(w.name)

    records.push({ name: `${w.name}.${domain}`, type: 'A', value: w.ip, vmName: w.name })

    if (seenIps.has(w.ip)) {
      // Forward record above still stands; only the ambiguous reverse is withheld.
      skipped.push({ name: w.name, reason: `duplicate address ${w.ip} — reverse record omitted` })
      continue
    }
    seenIps.add(w.ip)
    records.push({ name: reverseName(w.ip), type: 'PTR', value: `${w.name}.${domain}`, vmName: w.name })
  }

  return { domain, ttl, serial: opts.serial, records, skipped }
}

/**
 * Render the zone as a dnsmasq `--addn-hosts` file.
 *
 * This format, not a BIND zone file: dnsmasq derives the PTR from the same line automatically, so
 * a hosts file cannot express a forward record whose reverse disagrees with it. A hand-written
 * zone file can, and that inconsistency is invisible until someone runs a reverse lookup.
 *
 * The consequence for the caller: a `duplicate address` skip means dnsmasq will answer the
 * reverse with whichever name it read first. That is inherent to the format and preferable to the
 * alternative, which is two authoritative PTRs disagreeing.
 */
export function renderHostsFile(zone: DnsZone): string {
  const header = [
    '# Generated by Weaver — DO NOT EDIT.',
    '# Source: the workload registry. Regenerated whenever a workload is added, removed or',
    '# re-addressed; any manual change here is lost on the next write.',
    `# domain=${zone.domain} serial=${zone.serial} ttl=${zone.ttl}`,
    '',
  ]
  const lines = zone.records
    .filter(r => r.type === 'A')
    .map(r => `${r.value}\t${r.name}\t${r.name.split('.')[0]}`)
  return [...header, ...lines, ''].join('\n')
}

/**
 * Has the zone's content changed?
 *
 * Compares RECORDS, never the serial — the serial is derived from the answer, so including it
 * would make every comparison report a change and the resolver would reload on every tick.
 */
export function zoneContentEquals(a: DnsZone, b: DnsZone): boolean {
  if (a.domain !== b.domain || a.ttl !== b.ttl) return false
  if (a.records.length !== b.records.length) return false
  const key = (r: DnsRecord) => `${r.type}|${r.name}|${r.value}`
  const as = a.records.map(key).sort()
  const bs = b.records.map(key).sort()
  return as.every((v, i) => v === bs[i])
}
