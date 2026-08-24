// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { WorkloadRegistry, WorkloadDefinition, ProvisioningState } from '../storage/workload-registry.js'
import { parseMicrovmDeclarations } from './nix-config-parser.js'
import type { Provisioner } from './provisioner-types.js'
import type { DashboardConfig } from '../config.js'
import { STATUSES, PROVISIONING, TIERS, TIER_ORDER, type WorkloadStatus } from '../constants/vocabularies.js'
import { isDivergentNetwork } from './network-ownership.js'
import { runProbes, type WorkloadServiceProbe } from './health-probe.js'

const execFileAsync = promisify(execFile)

export interface WorkloadInfo {
  name: string
  status: WorkloadStatus
  ip: string
  mem: number
  vcpu: number
  hypervisor: string
  diskSize?: number // Disk size in GB (default: 10)
  uptime: string | null
  distro?: string
  guestOs?: 'linux' | 'windows'
  provisioningState?: ProvisioningState
  provisioningError?: string
  autostart?: boolean
  description?: string
  tags?: string[]
  bridge?: string
  /**
   * Network-ownership phase A — `bridge` is set and is NOT the Weaver-managed bridge.
   *
   * Derived server-side and shipped, rather than letting the UI compare, because the UI CANNOT
   * do it correctly: the frontend has no access to `bridgeInterface` and no shared module with
   * the backend, so a UI-side comparison means exposing the config AND writing a second
   * implementation of the predicate. The plan's requirement is that the comparison happen in
   * exactly one place so the UI and phase B's enforcement cannot disagree — one derived boolean
   * honours that better than the plan's literal "the panel compares" wording.
   *
   * `undefined` when unknown (no config yet), never a silent `false`.
   */
  networkDivergent?: boolean
  macAddress?: string
  tapInterface?: string
  runtime?: 'microvm' | 'docker' | 'podman' | 'apptainer'
  containerId?: string
  image?: string
  ports?: string[]
  /**
   * Per-service health, computed each `listVms()` and shipped on the existing `vm-status`
   * broadcast — no protocol change. `status` says the workload is running; this says whether the
   * service inside it answers.
   */
  serviceProbes?: WorkloadServiceProbe[]
}

export type { WorkloadDefinition, ProvisioningState }

let registry: WorkloadRegistry
let provisioner: Provisioner | null = null
let config: DashboardConfig | null = null

export function setRegistry(reg: WorkloadRegistry): void {
  registry = reg
}

export function setProvisioner(p: Provisioner | null): void {
  provisioner = p
}

export function setConfig(c: DashboardConfig): void {
  config = c
}

export function getConfig(): DashboardConfig | null {
  return config
}

/** Check if a VM is a QEMU-managed VM (cloud-init or ISO-install, not NixOS).
 *  Accepts a WorkloadDefinition directly. */
function isCloudDef(def: WorkloadDefinition): boolean {
  if (!provisioner) return false
  // Check image catalog (cloud-init or ISO)
  if (provisioner.isQemuVm(def.distro)) return true
  // Fallback: VM has QEMU provisioning metadata (distro definition may have been deleted)
  if (def.tapInterface && def.macAddress && def.distro && def.distro !== 'nixos') return true
  return false
}

async function isCloudVm(name: string): Promise<boolean> {
  if (!provisioner) return false
  const def = await registry.get(name)
  return def ? isCloudDef(def) : false
}

// --- Container runtime helpers ---

type ContainerRuntime = 'docker' | 'podman' | 'apptainer'

function isContainerDef(def: WorkloadDefinition): boolean {
  return def.runtime === 'docker' || def.runtime === 'podman' || def.runtime === 'apptainer'
}

/**
 * May this install see Apptainer workloads at all?
 *
 * Apptainer requires Solo, and below Solo it is **hidden, not nagged**. The gate lives HERE,
 * in the service, rather
 * than only in the scan route, because the registry is what every consumer reads: the scan is
 * the primary exclusion, but a workload that reached the registry by another path (a hand-edited
 * registry file, a tier downgrade after a Solo-era scan) would otherwise flow straight out
 * through `listVms()` and the `vm-status` broadcast.
 *
 * Fails CLOSED on an absent config — an indeterminate tier must not serve a Solo-gated feature.
 * This mirrors the same decision already taken on the logs route (`workloads.ts`), where every
 * other config read falls back to a harmless default and only the tier check refuses to.
 */
function apptainerVisible(): boolean {
  if (!config) return false
  return TIER_ORDER[config.tier] >= TIER_ORDER[TIERS.SOLO]
}

// --- Pure parsers for container runtime output ---

/**
 * Parse a single line of `docker ps -a --format '{{json .}}'` output.
 * Returns { name, id, image, state, ports, networks } or null if the line is invalid.
 * Never throws. Pure function - no I/O.
 *
 * `networks` is network-ownership phase A: Weaver owns the bridge and the address space — no
 * runtime brings its own network. Docker's `{{json .}}` has always emitted a `Networks` field and this
 * parser has always discarded it, which is why Weaver could not even *report* a container
 * attached to docker0 instead of `bridgeInterface`. The captured fixture in
 * container-parsers.spec.ts reads `"Networks":"bridge"` — docker0, not `br-microvm` — so the
 * divergence this observes is real and already present in the test data.
 *
 * Comma-separated, same shape as `Ports`, and split the same way: an empty string yields `[]`,
 * never `['']`. That precedent matters — a `['']` would make an unnetworked container look like
 * one attached to a network named "".
 */
export function parseDockerPsLine(line: string): { name: string; id?: string; image?: string; state?: string; ports: string[]; networks: string[] } | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>

    const rawName = typeof parsed['Names'] === 'string' ? parsed['Names'] : null
    if (!rawName) return null
    // Strip leading '/' (Docker prefixes container names with '/')
    const name = rawName.startsWith('/') ? rawName.slice(1) : rawName
    if (!name) return null

    const id = typeof parsed['ID'] === 'string' ? parsed['ID'] : undefined
    const image = typeof parsed['Image'] === 'string' ? parsed['Image'] : undefined
    const state = typeof parsed['State'] === 'string' ? parsed['State'] : undefined
    const rawPorts = typeof parsed['Ports'] === 'string' ? parsed['Ports'] : ''
    const rawNetworks = typeof parsed['Networks'] === 'string' ? parsed['Networks'] : ''

    // Split comma-separated port mappings, filter empties
    const ports = rawPorts ? rawPorts.split(',').map(p => p.trim()).filter(Boolean) : []
    // Same shape, same split — `filter(Boolean)` is what keeps '' out as [] rather than ['']
    const networks = rawNetworks ? rawNetworks.split(',').map(n => n.trim()).filter(Boolean) : []

    return { name, id, image, state, ports, networks }
  } catch {
    return null
  }
}

/**
 * Parse `apptainer instance list --json` output.
 * Returns an array of { name, image, pid } for each running instance.
 * Apptainer has no daemon and no stopped-instance record: an instance either exists (running)
 * or is absent entirely. There is nothing to report as 'exited' or 'failed', so the parser must
 * not invent a state field — presence IS the state.
 * Never throws. Pure function - no I/O.
 */
export function parseApptainerInstances(stdout: string): { name: string; image: string; pid: number }[] {
  try {
    const parsed = JSON.parse(stdout) as { instances?: unknown[] }

    if (!parsed || !Array.isArray(parsed.instances)) {
      return []
    }

    const result: { name: string; image: string; pid: number }[] = []
    for (const instance of parsed.instances) {
      if (!instance || typeof instance !== 'object') continue

      const record = instance as Record<string, unknown>
      const name = typeof record['instance'] === 'string' ? record['instance'] : null
      if (!name) continue

      const image = typeof record['img'] === 'string' ? record['img'] : ''
      const pid = typeof record['pid'] === 'number' ? record['pid'] : 0

      result.push({ name, image, pid })
    }

    return result
  } catch {
    return []
  }
}

/**
 * Kernel clock ticks per second — `sysconf(_SC_CLK_TCK)`, which `/proc/<pid>/stat` field 22 is
 * denominated in. Node exposes no binding for it, and it is 100 on every Linux ABI Weaver runs
 * on (it has been the fixed USER_HZ since 2.6; the kernel's internal HZ is a different number
 * and is deliberately not visible here). If it were ever wrong, the consequence is a start time
 * skewed by a constant factor — a cosmetic uptime error, not a failed lookup.
 */
const CLOCK_TICKS_PER_SEC = 100

/**
 * Pull field 22 (`starttime`, in clock ticks since boot) out of a `/proc/<pid>/stat` line.
 *
 * **Parse from the LAST `)`, never by splitting from the left.** Field 2 is the executable name
 * wrapped in parentheses, and it may contain spaces *and* parentheses — `(my prog (v2))` is a
 * legal comm. Splitting on whitespace from the start therefore shifts every later field by an
 * amount that depends on the process's own name, which is exactly the kind of bug that passes
 * every test written against a well-behaved fixture. Everything after the final `)` is
 * fixed-width: `state` is field 3, so `starttime` (field 22) is index 19 of that remainder.
 *
 * Never throws. Pure function - no I/O.
 */
export function parseProcStatStartTicks(stat: string): number | null {
  const close = stat.lastIndexOf(')')
  if (close === -1) return null
  const fields = stat.slice(close + 1).trim().split(/\s+/)
  // fields[0] is field 3 (state); field N maps to fields[N - 3].
  const raw = fields[19]
  if (raw === undefined) return null
  const ticks = Number(raw)
  if (!Number.isFinite(ticks) || ticks < 0) return null
  return ticks
}

/**
 * Pull `btime` (boot time, epoch seconds) out of `/proc/stat`.
 * Needed because `/proc/<pid>/stat` reports a start time RELATIVE to boot, not an absolute one.
 * Never throws. Pure function - no I/O.
 */
export function parseProcBtime(procStat: string): number | null {
  const match = procStat.match(/^btime[ \t]+(\d+)/m)
  if (!match) return null
  const btime = Number(match[1])
  if (!Number.isFinite(btime) || btime <= 0) return null
  return btime
}

// --- Container log surface (pure functions for testability) ---

/**
 * Check if a runtime uses container logs (docker/podman/apptainer).
 * An absent runtime is a microvm and must keep the provisioning-log path.
 */
export function isContainerLogSource(runtime?: string): boolean {
  return runtime === 'docker' || runtime === 'podman' || runtime === 'apptainer'
}

/**
 * Build argv for docker/podman logs command.
 * Default lines=200, clamped to [1, 10000].
 * Never includes -f/--follow which would hang the request.
 */
export function containerLogArgs(runtime: string, name: string, lines?: number): string[] {
  const n = lines ?? 200
  const clamped = Math.max(1, Math.min(10000, n))
  return ['logs', '--tail', String(clamped), name]
}

/**
 * Parse Apptainer instance list --json output to get log paths.
 * Apptainer has no 'logs' subcommand; logOutPath/logErrPath are in instance list JSON.
 * Returns { out, err } or null. Never throws.
 */
export function apptainerLogPaths(stdout: string, name: string): { out: string; err: string } | null {
  try {
    const parsed = JSON.parse(stdout)
    if (!parsed || !Array.isArray(parsed.instances)) return null
    for (const instance of parsed.instances) {
      if (instance.instance === name &&
          typeof instance.logOutPath === 'string' &&
          typeof instance.logErrPath === 'string') {
        // These paths are about to be read off disk, and they arrive from ANOTHER PROCESS's
        // stdout. `name` is already regex-constrained by the route, so the caller cannot traverse
        // through it — but that is not the whole threat. Whatever the binary at APPTAINER_BIN
        // prints, we would otherwise open: a wrong/shimmed/compromised binary turns this into an
        // arbitrary-file read as the weaver service user, and `.catch(() => '')` at the read site
        // means it fails silently rather than loudly.
        //
        // So the shape is checked before the read, against the real emitted form (captured from
        // apptainer-slim 1.5.0, 2026-07-31):
        //   /root/.apptainer/instances/logs/<hostname>/root/testinst.out
        // Absolute, under an `.apptainer/instances/logs/` segment, basename exactly `<name>.out` /
        // `<name>.err`, and no `..` anywhere. This is defence in depth, not the primary control —
        // it just means trusting the binary's LOCATION rather than its OUTPUT.
        if (!isApptainerInstanceLogPath(instance.logOutPath, name, 'out')) return null
        if (!isApptainerInstanceLogPath(instance.logErrPath, name, 'err')) return null
        return { out: instance.logOutPath, err: instance.logErrPath }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Is this the shape Apptainer actually emits for an instance log path?
 * Absolute, no traversal, under `.apptainer/instances/logs/`, basename `<name>.<ext>`.
 */
export function isApptainerInstanceLogPath(p: string, name: string, ext: 'out' | 'err'): boolean {
  if (typeof p !== 'string' || !p.startsWith('/')) return false
  if (p.includes('..') || p.includes('\0')) return false
  if (!p.includes('/.apptainer/instances/logs/')) return false
  return p.endsWith(`/${name}.${ext}`)
}

/** Workload names reach a filesystem path and a systemd unit. Same charset the routes enforce. */
const CLONE_NAME_RE = /^[a-z][a-z0-9-]*$/

/**
 * The guard that runs BEFORE anything is created. Returns a reason, or null when the clone is
 * allowed. Pure: arguments in, value out.
 *
 * Every rejection here is a refusal, never a repair. Silently rewriting an invalid name would
 * create a workload the user did not ask for and cannot find.
 */
export function cloneRejectionReason(opts: {
  source: WorkloadDefinition | null
  targetName: string
  existingNames: string[]
  status: string
}): string | null {
  const { source, targetName, existingNames, status } = opts
  if (!source) return 'Source workload not found'
  if (existingNames.includes(targetName)) return `A workload named '${targetName}' already exists`
  if (targetName === source.name) return 'Target name must differ from the source name'
  if (!CLONE_NAME_RE.test(targetName)) {
    return 'Name must start with a lowercase letter and contain only lowercase letters, digits and hyphens'
  }
  // Copying a disk mid-write is corruption. Refuse rather than best-effort it.
  if (status === 'running') return 'Cannot clone a running workload — stop it first'
  // A container is reproduced from its image, not by copying a disk.
  if (isContainerDef(source)) {
    return 'Container workloads are reproduced from their image, not cloned from a disk'
  }
  return null
}

/**
 * Fields a clone inherits. This is an ALLOWLIST, and it must stay one.
 *
 * The obvious implementation is `{ ...source, name, ip, macAddress: undefined, … }` — a denylist.
 * It passes every field-by-field test and is wrong twice over: it carries `consolePort` (a
 * per-instance allocated port that collides exactly as a copied MAC does), it carries
 * `provisioningState`/`provisioningError` so a never-built clone reports as built and inherits a
 * stale error from another VM — and it silently inherits every field added to WorkloadDefinition
 * afterwards. An allowlist fails closed on a new field; a denylist fails open.
 */
const CLONE_INHERITED_FIELDS = [
  'mem',
  'vcpu',
  'hypervisor',
  'diskSize',
  'distro',
  'guestOs',
  'vmType',
  'bridge',
  'consoleType',
  'imageUrl',
  'imageFormat',
  'cloudInit',
  'description',
  'tags',
] as const satisfies readonly (keyof WorkloadDefinition)[]

/**
 * Derive a new definition from a source. Pure, and never mutates the source.
 *
 * Deliberately absent from the result — not set to `undefined`, ABSENT, because `{ …, x: undefined }`
 * leaves an own enumerable key that `'x' in obj` still sees:
 *   macAddress / tapInterface  per-instance identity; a copy collides on the bridge and in the kernel
 *   consolePort                per-instance allocation; the same collision, one layer up
 *   provisioningState/Error    lifecycle state belonging to the source instance alone
 *   containerId / image / ports  container fields; a clone is a VM operation
 *   autostart                  a clone that autostarts is a reboot behaviour nobody chose
 */
export function deriveClonedDefinition(
  source: WorkloadDefinition,
  targetName: string,
  newIp: string,
): WorkloadDefinition {
  const clone = { name: targetName, ip: newIp } as WorkloadDefinition
  for (const key of CLONE_INHERITED_FIELDS) {
    const value = source[key]
    if (value === undefined) continue // omit the key entirely rather than writing undefined
    // Assigning through a union of value types needs the cast; the key set is compile-time checked
    // by `satisfies readonly (keyof WorkloadDefinition)[]` above, so this cannot address a
    // field that does not exist.
    // sast-ignore[prototype-pollution]: `key` iterates CLONE_INHERITED_FIELDS, a module-level
    // `as const` tuple constrained to keyof WorkloadDefinition — it is never caller-supplied and
    // cannot be __proto__/constructor. The warning is correct about the shape and wrong about
    // this instance; the guard that makes it safe is the compile-time key set, not a runtime check.
    ;(clone as Record<string, unknown>)[key] = value
  }
  return clone
}

/**
 * Fields an export carries. An ALLOWLIST, for the same reason the clone one is
 * (`CLONE_INHERITED_FIELDS` above): a denylist silently exports every field added to
 * `WorkloadDefinition` afterwards, and an export is a file a user keeps, mails and pastes into an
 * issue. Failing closed on a new field costs one line here; failing open publishes it.
 *
 * Note what is absent and why — this is not the same omission set as clone:
 *   provisioningState / provisioningError   runtime lifecycle, not configuration. Re-importing
 *                                           "provisioned" would describe a VM that does not exist
 *   consolePort                             a live allocation on the exporting host
 *   containerId                             a runtime handle, meaningless off this host
 * `macAddress` IS included, unlike in a clone: an export is a record OF this VM, and its address
 * is part of what the record describes. A clone is a NEW VM, so inheriting one would collide.
 */
const EXPORT_FIELDS = [
  'name',
  'ip',
  'mem',
  'vcpu',
  'hypervisor',
  'diskSize',
  'distro',
  'guestOs',
  'vmType',
  'macAddress',
  'autostart',
  'description',
  'tags',
  'bridge',
  'consoleType',
  'imageUrl',
  'imageFormat',
  'cloudInit',
  'runtime',
  'image',
  'ports',
] as const satisfies readonly (keyof WorkloadDefinition)[]

/**
 * The exported shape, DERIVED from the allowlist rather than written out again.
 *
 * `Pick` preserves each field's own optionality, so `name`/`ip`/`mem`/`vcpu`/`hypervisor` stay
 * required and the rest stay optional. The first cut returned `Partial<WorkloadDefinition>`,
 * which typechecks in isolation and is wrong: it makes the five always-present fields look
 * optional, and Fastify then rejects the handler because its response schema requires them.
 * Deriving also means adding a field to EXPORT_FIELDS updates this type for free — a second
 * hand-written interface here would be a copy that drifts.
 */
export type ExportedWorkload = Pick<WorkloadDefinition, (typeof EXPORT_FIELDS)[number]>

/** One workload's exportable configuration. Pure; never mutates the source. */
export function toExportedDefinition(source: WorkloadDefinition): ExportedWorkload {
  const out: Record<string, unknown> = {}
  for (const key of EXPORT_FIELDS) {
    const value = source[key]
    if (value === undefined) continue // omit the key rather than writing undefined
    // sast-ignore[prototype-pollution]: `key` iterates EXPORT_FIELDS, a module-level `as const`
    // tuple constrained to keyof WorkloadDefinition. Never caller-supplied, so it cannot be
    // __proto__/constructor; the compile-time key set is the guard, not a runtime check.
    out[key] = Array.isArray(value) ? [...value] : value
  }
  // The cast is the one place the compile-time guarantee has to be restated: the loop builds a
  // Record<string, unknown>, but EXPORT_FIELDS is `satisfies readonly (keyof WorkloadDefinition)[]`
  // and every non-optional field it names is non-optional on the source, so the five required
  // fields are always written. Asserted directly by the "carries every configuration field" test,
  // which compares a route response against this function's own output.
  return out as ExportedWorkload
}

/**
 * The full export document.
 *
 * `exportedAt` is supplied by the caller rather than read from the clock in here, so the function
 * stays pure and a test can assert the whole document instead of everything-except-one-field.
 */
export function buildExportDocument(
  definitions: WorkloadDefinition[],
  exportedAt: string,
): { version: string; exportedAt: string; workloads: ExportedWorkload[] } {
  return {
    version: '1.0',
    exportedAt,
    workloads: definitions.map(toExportedDefinition),
  }
}

/**
 * Fetch logs for a container workload. Returns null when there are none to serve.
 *
 * Lives HERE rather than in the route because in this codebase routes do not touch the system —
 * services do. That is not only style: `no-raw-execfile-args` (scripts/semgrep-rules/) is a taint
 * rule from `$REQ.params` to `execFile`, and it fired on the first cut of this feature precisely
 * because the exec sat in the route file with the request params in scope. Every other system call
 * — startVm, getContainerStatus, getVmUptime — is on this side of the boundary and none of them
 * trip it. `name` is regex-constrained by the route's Zod schema before it ever arrives.
 */
export async function getContainerLogs(
  name: string,
  runtime: string,
  tailLines = 200,
): Promise<string | null> {
  if (runtime === 'apptainer') {
    const bin = config?.apptainerBin ?? 'apptainer'
    const { stdout } = await execFileAsync(bin, ['instance', 'list', '--json'])
    const paths = apptainerLogPaths(stdout, name)
    if (!paths) return null
    const { readFile } = await import('node:fs/promises')
    const [outLog, errLog] = await Promise.all([
      readFile(paths.out, 'utf-8').catch(() => ''),
      readFile(paths.err, 'utf-8').catch(() => ''),
    ])
    return [outLog, errLog].filter(s => s.length > 0).join('\n')
  }

  const bin = runtime === 'docker' ? (config?.dockerBin ?? 'docker') : (config?.podmanBin ?? 'podman')
  const { stdout } = await execFileAsync(bin, containerLogArgs(runtime, name, tailLines))
  return stdout
}

function getContainerBin(runtime: ContainerRuntime): string {
  if (runtime === 'docker') return config?.dockerBin ?? 'docker'
  if (runtime === 'apptainer') return config?.apptainerBin ?? 'apptainer'
  return config?.podmanBin ?? 'podman'
}

/**
 * The one Apptainer discovery call: `apptainer instance list --json`.
 *
 * Everything Weaver knows about a running instance comes from here — status, uptime's pid, and
 * the log paths. Apptainer has no daemon and no `ps -a` equivalent, so there is no second source
 * to reconcile against. A missing binary yields `[]`, never a throw: the same contract
 * `scanContainers` already honors for docker/podman.
 */
async function listApptainerInstances(): Promise<{ name: string; image: string; pid: number }[]> {
  try {
    const bin = getContainerBin('apptainer')
    const { stdout } = await execFileAsync(bin, ['instance', 'list', '--json'])
    return parseApptainerInstances(stdout)
  } catch {
    return []
  }
}

/**
 * Apptainer status is presence, and only presence.
 *
 * An instance either exists (running) or does not exist at all — there is no stopped-instance
 * record to inspect, so `failed` is not a state this runtime can report and must never be
 * synthesised. `unknown` is reserved for "we could not ask" (binary missing, exec refused),
 * which is what `listApptainerInstances()` returning `null` distinguishes from a real empty list.
 */
async function getApptainerStatus(name: string): Promise<WorkloadStatus> {
  try {
    const bin = getContainerBin('apptainer')
    const { stdout } = await execFileAsync(bin, ['instance', 'list', '--json'])
    const present = parseApptainerInstances(stdout).some((i) => i.name === name)
    return present ? STATUSES.RUNNING : STATUSES.STOPPED
  } catch {
    return STATUSES.UNKNOWN
  }
}

/**
 * Apptainer uptime is derived from the instance's pid, because there is nothing else to derive
 * it from — `instance list --json` carries no start time, and there is no daemon to ask.
 * Returns an ISO timestamp (matching the docker/podman `StartedAt` shape the frontend already
 * renders), or `null`, which is a valid answer here rather than an error.
 */
async function getApptainerUptime(name: string): Promise<string | null> {
  const instance = (await listApptainerInstances()).find((i) => i.name === name)
  if (!instance || !Number.isInteger(instance.pid) || instance.pid <= 0) return null
  try {
    const [stat, procStat] = await Promise.all([
      readFile(`/proc/${instance.pid}/stat`, 'utf-8'),
      readFile('/proc/stat', 'utf-8'),
    ])
    const ticks = parseProcStatStartTicks(stat)
    const btime = parseProcBtime(procStat)
    if (ticks === null || btime === null) return null
    return new Date((btime + ticks / CLOCK_TICKS_PER_SEC) * 1000).toISOString()
  } catch {
    // The process exited between the list and the read — a normal race, not an error.
    return null
  }
}

async function getContainerStatus(name: string, runtime: ContainerRuntime): Promise<WorkloadStatus> {
  if (runtime === 'apptainer') return getApptainerStatus(name)
  try {
    const bin = getContainerBin(runtime)
    const { stdout } = await execFileAsync(bin, ['inspect', '--format', '{{.State.Status}}', name])
    const state = stdout.trim()
    if (state === STATUSES.RUNNING) return STATUSES.RUNNING
    if (state === 'exited')  return STATUSES.STOPPED
    if (state === 'paused')  return STATUSES.IDLE
    if (state === 'dead')    return STATUSES.FAILED
    return STATUSES.UNKNOWN
  } catch {
    return STATUSES.UNKNOWN
  }
}

async function getContainerUptime(name: string, runtime: ContainerRuntime): Promise<string | null> {
  if (runtime === 'apptainer') return getApptainerUptime(name)
  try {
    const bin = getContainerBin(runtime)
    const { stdout } = await execFileAsync(bin, ['inspect', '--format', '{{.State.StartedAt}}', name])
    const ts = stdout.trim()
    if (!ts) return null
    return ts
  } catch {
    return null
  }
}

export async function getVmStatus(name: string): Promise<WorkloadStatus> {
  const def = await registry.get(name)
  if (def && isContainerDef(def)) {
    return getContainerStatus(name, def.runtime as ContainerRuntime)
  }

  if (provisioner && await isCloudVm(name)) {
    return provisioner.getCloudVmStatus(name)
  }

  const systemctl = config?.systemctlBin ?? 'systemctl'
  const unit = `microvm@${name}.service`

  // systemctl exits non-zero for inactive/failed states but still writes to stdout — capture both
  async function sysctl(...args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync(systemctl, args)
      return stdout.trim()
    } catch (err: unknown) {
      return ((err as { stdout?: string }).stdout ?? '').trim()
    }
  }

  const active = await sysctl('is-active', unit)
  if (active === 'active')   return STATUSES.RUNNING
  if (active === STATUSES.FAILED)   return STATUSES.FAILED
  if (active === 'inactive') {
    // Distinguish intentional stop (idle) from anomalous stop (stopped).
    // is-enabled returns 'enabled' when the unit starts on boot — if it's
    // inactive despite being enabled, something unexpected stopped it.
    const enabled = await sysctl('is-enabled', unit)
    return enabled === 'enabled' ? STATUSES.STOPPED : STATUSES.IDLE
  }
  return STATUSES.UNKNOWN
}

export async function getVmUptime(name: string): Promise<string | null> {
  const def = await registry.get(name)
  if (def && isContainerDef(def)) {
    return getContainerUptime(name, def.runtime as ContainerRuntime)
  }

  if (provisioner && await isCloudVm(name)) {
    return provisioner.getCloudVmUptime(name)
  }
  try {
    const { stdout } = await execFileAsync(config?.systemctlBin ?? 'systemctl', [
      'show', `microvm@${name}.service`, '--property=ActiveEnterTimestamp', '--value'
    ])
    const timestamp = stdout.trim()
    if (!timestamp || timestamp === '') return null
    return timestamp
  } catch {
    return null
  }
}

export async function listVms(): Promise<WorkloadInfo[]> {
  const defs = await registry.getAll()
  // Apptainer is hidden below Solo. Filtering HERE rather than in the route covers the
  // `vm-status` WebSocket broadcast in the same stroke — ws.ts calls listVms() too, and a
  // route-only filter is exactly the "registered but filtered at render" leak the gate forbids.
  const entries = Object.entries(defs).filter(
    ([, def]) => def.runtime !== 'apptainer' || apptainerVisible(),
  )

  // Phase 1: fetch all statuses in parallel
  const statuses = await Promise.all(entries.map(([name]) => getVmStatus(name)))

  // Phase 2: fetch uptimes in parallel (only for running VMs)
  const uptimes = await Promise.all(
    entries.map(([name], i) =>
      statuses[i] === STATUSES.RUNNING ? getVmUptime(name) : Promise.resolve(null)
    )
  )

  // Phase 3: run service probes in parallel, for every workload that declares any.
  //
  // Sequenced AFTER status because a stopped workload must not be probed at all — runProbes()
  // returns `unknown` for it rather than spending a timeout discovering what we already know.
  // Total wall-clock stays inside the 2s broadcast window: probes for all workloads run
  // concurrently, and the 1.5s TCP / 2s HTTP budgets are per-probe, not cumulative.
  const probed = await Promise.all(
    entries.map(([, def], i) => {
      const probes = def.serviceProbes
      if (!probes || probes.length === 0) return Promise.resolve(undefined)
      return runProbes(def.ip, statuses[i]!, probes)
    }),
  )

  // `...def` now carries `serviceProbes` as SPECS (no `health`), so the field must be overwritten
  // unconditionally rather than only when a probe ran. Spreading the spec into a WorkloadInfo would
  // ship configuration shaped like a result: the response schema requires `health`, so Fastify
  // would reject its own payload — and if the schema ever relaxed, the UI would render probe rows
  // with no health at all. TypeScript caught this the moment the field became typed; it was
  // invisible while `serviceProbes` was reached through a cast.
  return entries.map(([, def], i) => ({
    ...def,
    status: statuses[i],
    uptime: uptimes[i],
    networkDivergent: networkDivergence(def),
    serviceProbes: probed[i],
  }))
}

/**
 * Network-ownership phase A — the observed divergence flag, computed in the ONE place that owns the
 * comparison. `undefined` (not `false`) when config is absent: an indeterminate answer must not
 * render as "conformant", which is the boolean-else-branch trap
 * (`L-analysis-2026-08-07-01KZFBEXWJFQC44HBMXWVPVBX2`).
 */
function networkDivergence(def: WorkloadDefinition): boolean | undefined {
  if (!config) return undefined
  return isDivergentNetwork(def.bridge, config.bridgeInterface)
}

/**
 * One workload, by name.
 *
 * `probe` is OPT-IN and defaults to false because two of the three callers want only a field off
 * the definition — the clone guard reads `status`, the logs route reads `runtime` — and probing
 * would spend up to 2s of network timeouts to answer a question neither asked. The detail route
 * opts in; it is the one place a caller is actually looking at service health.
 *
 * With `probe` false, configured probes are still reported, with `health: 'unknown'` — which is
 * this type's existing word for *not checked*, not for *no probes*. Dropping them instead would
 * tell an API client the workload has no probes configured, which is a different and false claim.
 */
export async function getVm(
  name: string,
  opts: { probe?: boolean } = {},
): Promise<WorkloadInfo | null> {
  const def = await registry.get(name)
  if (!def) return null
  // Below Solo an Apptainer workload is indistinguishable from one that does not exist — the
  // gate hides rather than nags. `null` here is what produces the route's 404 — the same answer an
  // unknown name gets, and deliberately not a 403 that would advertise the gated feature.
  if (def.runtime === 'apptainer' && !apptainerVisible()) return null
  const status = await getVmStatus(name)
  const uptime = status === STATUSES.RUNNING ? await getVmUptime(name) : null

  const specs = def.serviceProbes
  let serviceProbes: WorkloadServiceProbe[] | undefined
  if (specs && specs.length > 0) {
    serviceProbes = opts.probe
      ? await runProbes(def.ip, status, specs)
      : specs.map(s => ({ ...s, health: 'unknown' as const }))
  }

  return { ...def, status, uptime, networkDivergent: networkDivergence(def), serviceProbes }
}

function isProvisionedOrLegacy(def: WorkloadDefinition): boolean {
  return !def.provisioningState || def.provisioningState === PROVISIONING.PROVISIONED
}

/**
 * Below Solo an Apptainer workload does not exist as far as this install is concerned.
 * Returns the same `not found` message an unknown name gets, which the action routes map to 404 —
 * a 403 would tell a Free user precisely which feature they are missing, which is the nag the
 * decision refuses.
 */
function apptainerHidden(def: WorkloadDefinition, name: string): { success: false; message: string } | null {
  if (def.runtime === 'apptainer' && !apptainerVisible()) {
    return { success: false, message: `VM '${name}' not found` }
  }
  return null
}

/**
 * Start an Apptainer instance.
 *
 * Unlike docker/podman — where `start` resumes a container that already exists on disk — Apptainer
 * instantiates FROM an image every time: `apptainer instance start <image> <name>`. So the image
 * path recorded at scan time is a hard requirement, and its absence is a real, reportable failure
 * rather than something to paper over with a default.
 */
async function startApptainerInstance(def: WorkloadDefinition, name: string): Promise<{ success: boolean; message: string }> {
  if (!def.image) {
    return { success: false, message: `Cannot start instance '${name}': image path unknown. Re-scan the host to recover it.` }
  }
  try {
    await execFileAsync(getContainerBin('apptainer'), ['instance', 'start', def.image, name])
    return { success: true, message: `Instance '${name}' started` }
  } catch (err) {
    console.error(`[microvm] Failed to start apptainer instance '${name}':`, err)
    return { success: false, message: `Failed to start instance '${name}'. Check server logs for details.` }
  }
}

async function stopApptainerInstance(name: string): Promise<{ success: boolean; message: string }> {
  try {
    await execFileAsync(getContainerBin('apptainer'), ['instance', 'stop', name])
    return { success: true, message: `Instance '${name}' stopped` }
  } catch (err) {
    console.error(`[microvm] Failed to stop apptainer instance '${name}':`, err)
    return { success: false, message: `Failed to stop instance '${name}'. Check server logs for details.` }
  }
}

export async function startVm(name: string): Promise<{ success: boolean; message: string }> {
  const def = await registry.get(name)
  if (!def) return { success: false, message: `VM '${name}' not found` }
  const hidden = apptainerHidden(def, name)
  if (hidden) return hidden
  if (!isProvisionedOrLegacy(def)) {
    return { success: false, message: `VM '${name}' is not provisioned (state: ${def.provisioningState})` }
  }

  // Container workloads: delegate to docker/podman/apptainer
  if (isContainerDef(def)) {
    if (def.runtime === 'apptainer') return startApptainerInstance(def, name)
    try {
      const bin = getContainerBin(def.runtime as ContainerRuntime)
      await execFileAsync(bin, ['start', name])
      return { success: true, message: `Container '${name}' started` }
    } catch (err) {
      console.error(`[microvm] Failed to start container '${name}':`, err)
      return { success: false, message: `Failed to start container '${name}'. Check server logs for details.` }
    }
  }

  // Cloud VMs: delegate to provisioner (dashboard-managed QEMU process)
  if (provisioner && isCloudDef(def)) {
    return provisioner.startCloudVm(name)
  }

  // NixOS VMs: use systemctl
  try {
    await execFileAsync(config?.sudoBin ?? 'sudo', [config?.systemctlBin ?? 'systemctl', 'start', `microvm@${name}.service`])
    const status = await getVmStatus(name)
    if (status !== STATUSES.RUNNING) {
      return { success: false, message: `VM '${name}' failed to start (status: ${status})` }
    }
    return { success: true, message: `VM '${name}' started` }
  } catch (err) {
    console.error(`[microvm] Failed to start VM '${name}':`, err)
    return { success: false, message: `Failed to start VM '${name}'. Check server logs for details.` }
  }
}

export async function stopVm(name: string): Promise<{ success: boolean; message: string }> {
  const def = await registry.get(name)
  if (!def) return { success: false, message: `VM '${name}' not found` }
  const hidden = apptainerHidden(def, name)
  if (hidden) return hidden
  if (!isProvisionedOrLegacy(def)) {
    return { success: false, message: `VM '${name}' is not provisioned (state: ${def.provisioningState})` }
  }

  // Container workloads: delegate to docker/podman/apptainer
  if (isContainerDef(def)) {
    if (def.runtime === 'apptainer') return stopApptainerInstance(name)
    try {
      const bin = getContainerBin(def.runtime as ContainerRuntime)
      await execFileAsync(bin, ['stop', name])
      return { success: true, message: `Container '${name}' stopped` }
    } catch (err) {
      console.error(`[microvm] Failed to stop container '${name}':`, err)
      return { success: false, message: `Failed to stop container '${name}'. Check server logs for details.` }
    }
  }

  // Cloud VMs: delegate to provisioner
  if (provisioner && isCloudDef(def)) {
    return provisioner.stopCloudVm(name)
  }

  // NixOS VMs: use systemctl
  try {
    await execFileAsync(config?.sudoBin ?? 'sudo', [config?.systemctlBin ?? 'systemctl', 'stop', `microvm@${name}.service`])
    return { success: true, message: `VM '${name}' stopped` }
  } catch (err) {
    console.error(`[microvm] Failed to stop VM '${name}':`, err)
    return { success: false, message: `Failed to stop VM '${name}'. Check server logs for details.` }
  }
}

export async function restartVm(name: string): Promise<{ success: boolean; message: string }> {
  const def = await registry.get(name)
  if (!def) return { success: false, message: `VM '${name}' not found` }
  const hidden = apptainerHidden(def, name)
  if (hidden) return hidden
  if (!isProvisionedOrLegacy(def)) {
    return { success: false, message: `VM '${name}' is not provisioned (state: ${def.provisioningState})` }
  }

  // Container workloads: delegate to docker/podman/apptainer
  if (isContainerDef(def)) {
    // Apptainer has no `instance restart` — stop, then start from the recorded image. A failed
    // stop must not be swallowed: starting an instance whose name is still taken fails anyway,
    // and reporting the stop failure is the more actionable of the two messages.
    if (def.runtime === 'apptainer') {
      const stopped = await stopApptainerInstance(name)
      if (!stopped.success) return stopped
      const started = await startApptainerInstance(def, name)
      return started.success ? { success: true, message: `Instance '${name}' restarted` } : started
    }
    try {
      const bin = getContainerBin(def.runtime as ContainerRuntime)
      await execFileAsync(bin, ['restart', name])
      return { success: true, message: `Container '${name}' restarted` }
    } catch (err) {
      console.error(`[microvm] Failed to restart container '${name}':`, err)
      return { success: false, message: `Failed to restart container '${name}'. Check server logs for details.` }
    }
  }

  // Cloud VMs: stop then start via provisioner
  if (provisioner && isCloudDef(def)) {
    await provisioner.stopCloudVm(name)
    return provisioner.startCloudVm(name)
  }

  // NixOS VMs: use systemctl
  try {
    await execFileAsync(config?.sudoBin ?? 'sudo', [config?.systemctlBin ?? 'systemctl', 'restart', `microvm@${name}.service`])
    const status = await getVmStatus(name)
    if (status !== STATUSES.RUNNING) {
      return { success: false, message: `VM '${name}' failed to restart (status: ${status})` }
    }
    return { success: true, message: `VM '${name}' restarted` }
  } catch (err) {
    console.error(`[microvm] Failed to restart VM '${name}':`, err)
    return { success: false, message: `Failed to restart VM '${name}'. Check server logs for details.` }
  }
}

export async function createVm(vm: WorkloadDefinition): Promise<{ success: boolean; message: string }> {
  const added = await registry.add(vm)
  if (!added) return { success: false, message: `VM '${vm.name}' already exists` }
  return { success: true, message: `VM '${vm.name}' registered` }
}

export async function deleteVm(name: string): Promise<{ success: boolean; message: string }> {
  const status = await getVmStatus(name)
  if (status === STATUSES.RUNNING) {
    return { success: false, message: `VM '${name}' is running. Stop it before deleting.` }
  }
  const removed = await registry.remove(name)
  if (!removed) return { success: false, message: `VM '${name}' not found` }
  return { success: true, message: `VM '${name}' deleted` }
}

export async function getWorkloadDefinitions(): Promise<Record<string, WorkloadDefinition>> {
  return registry.getAll()
}

export async function removeVm(name: string): Promise<{ success: boolean; message: string }> {
  const def = await registry.get(name)
  if (!def) return { success: false, message: `VM '${name}' not found` }

  // Best-effort stop before removing
  try {
    await execFileAsync(config?.sudoBin ?? 'sudo', [config?.systemctlBin ?? 'systemctl', 'stop', `microvm@${name}.service`])
  } catch {
    // VM may already be stopped or service may not exist — that's fine
  }

  const removed = await registry.remove(name)
  if (!removed) return { success: false, message: `Failed to remove VM '${name}'` }
  return { success: true, message: `VM '${name}' removed` }
}

export async function addVm(def: { name: string; ip?: string; mem?: number; vcpu?: number; hypervisor?: string }): Promise<{ success: boolean; message: string }> {
  if (await registry.has(def.name)) {
    return { success: false, message: `VM '${def.name}' already exists` }
  }

  await registry.add({
    name: def.name,
    ip: def.ip ?? '',
    mem: def.mem ?? 0,
    vcpu: def.vcpu ?? 0,
    hypervisor: def.hypervisor ?? 'unknown',
  })
  return { success: true, message: `VM '${def.name}' added` }
}

export async function updateVmField(name: string, fields: Partial<WorkloadDefinition>): Promise<{ success: boolean; message: string }> {
  const updated = await registry.update(name, fields)
  if (!updated) return { success: false, message: `VM '${name}' not found` }
  return { success: true, message: `VM '${name}' updated` }
}

export interface ScanResult {
  discovered: string[]
  added: string[]
  existing: string[]
  /**
   * Already-known workloads whose derived specs (mem / vCPU / hypervisor) were re-read and had
   * changed. MicroVM scans only; container runtimes report their specs inline, so there is no
   * second source to drift from.
   */
  refreshed?: string[]
}

/**
 * Read microvm specs from the NixOS-generated run script at
 * `<microvmsDir>/<name>/current/bin/microvm-run`.
 * Parses QEMU/cloud-hypervisor/firecracker flags for memory, vCPU, and hypervisor.
 *
 * **The directory comes from config, and used to be hardcoded to `/var/lib/microvms`.** Every
 * other consumer of that path already read `config.microvmsDir` — `image-manager.ts` and
 * `provisioner.ts` both do — so a host that moved its state directory got correct behaviour
 * everywhere except here, in the discovery path.
 *
 * The failure was silent and specific: `readFile` throws, the catch returns the defaults, and the
 * workload registers with `vcpu: 0, mem: 0, hypervisor: 'unknown'`. Nothing errors. The UI shows a
 * VM with no specs, and because `weaver_workload_vcpus` is only published for a positive vCPU
 * count, the CPU chart for that workload is null forever — there is no divisor to normalise by.
 *
 * Measured on a host whose `microvm.stateDir` is `/data/microvms`: a running declarative microvm
 * declaring `vcpu = 1; mem = 256;` in its own config registered as 0/0/unknown.
 */
async function readMicrovmSpecs(name: string): Promise<{ mem: number; vcpu: number; hypervisor: string } | null> {
  const microvmsDir = config?.microvmsDir ?? '/var/lib/microvms'
  try {
    const script = await readFile(`${microvmsDir}/${name}/current/bin/microvm-run`, 'utf-8')

    // Detect hypervisor from the binary path
    let hypervisor = 'unknown'
    if (script.includes('qemu-system-')) hypervisor = 'qemu'
    else if (script.includes('cloud-hypervisor')) hypervisor = 'cloud-hypervisor'
    else if (script.includes('firecracker')) hypervisor = 'firecracker'
    else if (script.includes('crosvm')) hypervisor = 'crosvm'
    else if (script.includes('kvmtool')) hypervisor = 'kvmtool'

    // Parse memory: QEMU uses -m <MB>, cloud-hypervisor uses --memory size=<MB>M
    let mem = 0
    const qemuMem = script.match(/-m\s+(\d+)/)
    if (qemuMem) mem = parseInt(qemuMem[1], 10)
    if (!mem) {
      const chMem = script.match(/--memory\s+size=(\d+)M/)
      if (chMem) mem = parseInt(chMem[1], 10)
    }

    // Parse vCPU: QEMU uses -smp <N>, cloud-hypervisor uses --cpus boot=<N>
    let vcpu = 0
    const qemuSmp = script.match(/-smp\s+(\d+)/)
    if (qemuSmp) vcpu = parseInt(qemuSmp[1], 10)
    if (!vcpu) {
      const chCpu = script.match(/--cpus\s+boot=(\d+)/)
      if (chCpu) vcpu = parseInt(chCpu[1], 10)
    }

    return { mem, vcpu, hypervisor }
  } catch {
    // NULL, not zeros. The caller must be able to tell "this VM has no specs" from "I could not
    // read them", because the second must never be written over specs that are already correct —
    // a transient read failure would otherwise blank a healthy workload's vCPU count and silently
    // kill its CPU chart.
    return null
  }
}

/** The row a workload gets when its run script has never been readable. */
const UNKNOWN_SPECS = { mem: 0, vcpu: 0, hypervisor: 'unknown' } as const

export async function scanMicrovms(): Promise<ScanResult> {
  const systemctl = config?.systemctlBin ?? 'systemctl'
  const discovered: string[] = []
  const added: string[] = []
  const existing: string[] = []
  const refreshed: string[] = []

  try {
    const { stdout } = await execFileAsync(systemctl, [
      'list-units', 'microvm@*.service', '--no-legend', '--plain', '--all'
    ])

    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue
      // Format: "microvm@<name>.service loaded active running ..."
      const match = line.match(/^microvm@([^.]+)\.service\s/)
      if (!match) continue
      const name = match[1]
      discovered.push(name)

      const specs = await readMicrovmSpecs(name)

      if (await registry.has(name)) {
        existing.push(name)

        // REFRESH, don't just acknowledge. Scan used to only ever ADD, so a workload whose specs
        // were read wrong once kept that row forever — and since mem/vcpu/hypervisor are derived
        // from the generated run script rather than entered by a user, a stale row is simply
        // wrong rather than a preference to preserve. That made a path bug unrepairable in place:
        // every already-discovered VM stayed at 0/0/unknown after the path was corrected, on
        // every host, with no way to fix it below the tier that can delete a workload.
        //
        // Only when the script was actually readable (see the null above), and only the three
        // derived fields — ip, tags, description and autostart are the user's and are not touched.
        if (specs) {
          const current = await registry.get(name)
          const changed = !current
            || current.mem !== specs.mem
            || current.vcpu !== specs.vcpu
            || current.hypervisor !== specs.hypervisor
          if (changed) {
            await registry.update(name, specs)
            refreshed.push(name)
          }
        }
      } else {
        await registry.add({ name, ip: '', ...(specs ?? UNKNOWN_SPECS) })
        added.push(name)
      }
    }
  } catch {
    // systemctl list-units returns exit code 1 when no units match — not an error
  }

  return { discovered, added, existing, refreshed }
}

/**
 * Adopt guests DECLARED in the host's configuration.nix that Weaver does not know about yet.
 *
 * The gap this closes: `scanMicrovms()` enumerates `microvm@*.service`, so it can only see a guest
 * that has already been BUILT and activated. A guest declared this morning and not yet rebuilt is
 * invisible to it — and that is precisely the state the provisioner's own error message leaves the
 * user in ("declare the guest in your host's configuration.nix using microvm.nix, rebuild, then
 * run a workload scan to adopt it"). Between the declaration and the rebuild, Weaver had nothing
 * to say.
 *
 * DELIBERATELY ADDITIVE, NEVER AUTHORITATIVE. Three rules, and each has a reason:
 *
 *   1. **Never overwrite an existing row.** A built guest's specs come from its generated run
 *      script, which is what is actually running; the declaration is what someone intends to run.
 *      When they disagree the running value wins, so an already-known name is reported `existing`
 *      and left alone. `scanMicrovms()` owns refresh, and only from the run script.
 *   2. **No `provisioningState`.** Matching `scanMicrovms()` exactly — an adopted guest is not
 *      something Weaver provisioned, and marking it `registered` would make
 *      `isProvisionedOrLegacy()` false and quietly change how existing code treats it.
 *   3. **Absent specs stay absent**, via UNKNOWN_SPECS, rather than being invented. A declaration
 *      that sets memory in an imported module is unreadable to a line-based parser, and a
 *      confidently wrong 512 is worse than a visible gap.
 *
 * A missing or unreadable configuration.nix is not an error — plenty of hosts do not have one at
 * the configured path — so it returns an empty result, the same way a missing container binary
 * does.
 */
export async function scanNixDeclarations(): Promise<ScanResult> {
  const discovered: string[] = []
  const added: string[] = []
  const existing: string[] = []

  const path = config?.nixConfigPath
  if (!path) return { discovered, added, existing }

  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch {
    return { discovered, added, existing } // absent or unreadable — not an error
  }

  for (const decl of parseMicrovmDeclarations(raw)) {
    discovered.push(decl.name)
    if (await registry.has(decl.name)) {
      existing.push(decl.name)
      continue
    }
    await registry.add({
      name: decl.name,
      ip: decl.ip ?? '',
      mem: decl.mem ?? UNKNOWN_SPECS.mem,
      vcpu: decl.vcpu ?? UNKNOWN_SPECS.vcpu,
      hypervisor: decl.hypervisor ?? UNKNOWN_SPECS.hypervisor,
    })
    added.push(decl.name)
  }

  return { discovered, added, existing }
}

/**
 * Discover containers managed by docker or podman and register any new ones.
 * Uses `<bin> ps -a --format '{{json .}}'` — one JSON object per line.
 * If the runtime binary is not installed, returns an empty result (not an error).
 */
export async function scanContainers(runtime: ContainerRuntime): Promise<ScanResult> {
  if (runtime === 'apptainer') return scanApptainerInstances()

  const discovered: string[] = []
  const added: string[] = []
  const existing: string[] = []

  try {
    const bin = getContainerBin(runtime)
    const { stdout } = await execFileAsync(bin, ['ps', '-a', '--format', '{{json .}}'])

    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue

      const parsed = parseDockerPsLine(line)
      if (!parsed) continue

      discovered.push(parsed.name)

      if (await registry.has(parsed.name)) {
        existing.push(parsed.name)
      } else {
        await registry.add({
          name: parsed.name,
          ip: '',
          mem: 0,
          vcpu: 0,
          hypervisor: runtime,
          runtime,
          containerId: parsed.id,
          image: parsed.image,
          ports: parsed.ports.length > 0 ? parsed.ports : undefined,
          // Network-ownership phase A — record the network Weaver OBSERVES, not the one it wants.
          // First network only: `bridge` is singular on WorkloadDefinition, and a container on
          // several networks is already divergent from "one Weaver-managed bridge", so the first
          // is enough to say so. Undefined when docker reported none — absence is honest, and
          // isWeaverOwnedNetwork() treats unknown as not-violating.
          bridge: parsed.networks[0],
        })
        added.push(parsed.name)
      }
    }
  } catch {
    // Binary not found or returned non-zero — treat as not installed, return empty result
  }

  return { discovered, added, existing }
}

/**
 * Discover Apptainer instances and register any new ones.
 *
 * Not a `scanContainers` variant with different flags — a different shape of scan. `docker ps -a`
 * enumerates containers in every state; `apptainer instance list --json` enumerates only what is
 * running, because nothing else is recorded. So this scan discovers *running* instances and
 * cannot see one that has stopped; a stopped instance leaves no trace to find. That is the
 * runtime's model, not a limitation of this function.
 *
 * **Scan-time is where the Free-tier exclusion lives.** Excluding at render instead would
 * leave the workload in the registry, and a registered workload leaks through the `vm-status`
 * broadcast. Returning empty here means a Free install never learns the instance exists.
 */
export async function scanApptainerInstances(): Promise<ScanResult> {
  const discovered: string[] = []
  const added: string[] = []
  const existing: string[] = []

  if (!apptainerVisible()) return { discovered, added, existing }

  for (const instance of await listApptainerInstances()) {
    discovered.push(instance.name)

    if (await registry.has(instance.name)) {
      existing.push(instance.name)
    } else {
      await registry.add({
        name: instance.name,
        ip: '',
        mem: 0,
        vcpu: 0,
        hypervisor: 'apptainer',
        runtime: 'apptainer',
        // No containerId: Apptainer identifies an instance by name, and the pid is not a stable
        // identity — it changes on every start, so recording it would be recording a lie.
        image: instance.image || undefined,
        // No `bridge` either, for the same reason (network-ownership phase A). An Apptainer instance has no
        // network namespace of its own by default, so there is no network to observe — and the
        // field is left absent rather than set to a placeholder like '' or 'host'. Absence is the
        // honest answer; isWeaverOwnedNetwork() reads it as not-violating, deliberately, because
        // whether "no network" is a violation or a trivial conformance is an open product
        // question that a later phase must decide. Writing a placeholder here would answer it
        // by accident.
      })
      added.push(instance.name)
    }
  }

  return { discovered, added, existing }
}

export async function startAutostartVms(log: { info: (msg: string) => void; error: (msg: string) => void }): Promise<void> {
  const allDefs = await registry.getAll()
  for (const [name, def] of Object.entries(allDefs)) {
    if (!def.autostart) continue
    const status = await getVmStatus(name)
    if (status === STATUSES.RUNNING) continue
    try {
      await startVm(name)
      log.info(`Autostarted VM: ${name}`)
    } catch (err) {
      log.error(`Failed to autostart VM ${name}: ${err}`)
    }
  }
}
