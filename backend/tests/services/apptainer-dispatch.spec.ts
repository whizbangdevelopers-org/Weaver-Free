// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// Gap 1 of agents/v1.1.0/container-visibility.md, WIRING half (slice 2 of the slice table).
// Slice 1 landed the pure parsers; this covers what consumes them — the runtime union, the
// dispatch, the /proc uptime derivation, and the WVR-206 (Apptainer stays at v1.1.0 — Solo-gated,
// hidden on Free) tier gate.
//
// The load-bearing assertion in this file is NEGATIVE: an Apptainer workload must never reach
// systemd. Before slice 2, `isContainerDef` excluded apptainer, so an Apptainer workload fell
// through to the microvm path and Weaver reported `systemctl is-active microvm@<name>.service`
// as the instance's state — a confident, plausible, entirely fictional answer. A test that only
// asserts "status is running" passes in both worlds; asserting which BINARY was invoked is what
// separates them.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkloadRegistry, WorkloadDefinition } from '../../src/storage/workload-registry.js'
import type { DashboardConfig } from '../../src/config.js'

vi.mock('node:child_process', () => ({ execFile: vi.fn() }))
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))

import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import {
  getVmStatus,
  getVmUptime,
  listVms,
  getVm,
  startVm,
  stopVm,
  restartVm,
  scanContainers,
  scanApptainerInstances,
  parseProcStatStartTicks,
  parseProcBtime,
  setRegistry,
  setConfig,
} from '../../src/services/microvm.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────────────────────
// Real capture: `apptainer instance list --json`, apptainer-slim 1.5.0 on lab1, 2026-07-31.
const APPTAINER_LIST = `{
	"instances": [
		{
			"instance": "logtest",
			"pid": 6554,
			"img": "/root/.apptainer/cache/oci-tmp/6dfa7c8a3a99172fc36e13d2e17d1f73fb8cc5fe0cc2540c1027a8c134329184",
			"ip": "",
			"logErrPath": "/root/.apptainer/instances/logs/lab1/root/logtest.err",
			"logOutPath": "/root/.apptainer/instances/logs/lab1/root/logtest.out"
		}
	]
}`

const APPTAINER_EMPTY = `{
	"instances": []
}`

const APPTAINER_IMG =
  '/root/.apptainer/cache/oci-tmp/6dfa7c8a3a99172fc36e13d2e17d1f73fb8cc5fe0cc2540c1027a8c134329184'

const INSTANCE_DEF: WorkloadDefinition = {
  name: 'logtest',
  ip: '',
  mem: 0,
  vcpu: 0,
  hypervisor: 'apptainer',
  runtime: 'apptainer',
  image: APPTAINER_IMG,
}

const MICROVM_DEF: WorkloadDefinition = {
  name: 'web-nginx',
  ip: '10.10.0.10',
  mem: 256,
  vcpu: 1,
  hypervisor: 'qemu',
  distro: 'nixos',
}

function makeRegistry(initial: Record<string, WorkloadDefinition>): WorkloadRegistry {
  const vms: Record<string, WorkloadDefinition> = { ...initial }
  return {
    init: async () => {},
    getAll: async () => ({ ...vms }),
    get: async (name: string) => vms[name] ?? null,
    has: async (name: string) => name in vms,
    add: async (vm: WorkloadDefinition) => {
      if (vms[vm.name]) return false
      vms[vm.name] = vm
      return true
    },
    remove: async (name: string) => {
      if (!vms[name]) return false
      delete vms[name]
      return true
    },
    update: async (name: string, fields: Partial<WorkloadDefinition>) => {
      if (!vms[name]) return false
      vms[name] = { ...vms[name], ...fields }
      return true
    },
  }
}

function makeConfig(overrides: Partial<DashboardConfig> = {}): DashboardConfig {
  return {
    tier: 'weaver', // TIERS.SOLO — the tier at which Apptainer is visible
    apptainerBin: '/nix/store/abc-apptainer/bin/apptainer',
    dockerBin: 'docker',
    podmanBin: 'podman',
    systemctlBin: 'systemctl',
    sudoBin: 'sudo',
    containerRuntimes: ['docker', 'podman', 'apptainer'],
    ...overrides,
  } as unknown as DashboardConfig
}

type ExecCb = (err: Error | null, result?: { stdout: string; stderr: string }) => void
const execMock = () => execFile as unknown as ReturnType<typeof vi.fn>
const readMock = () => readFile as unknown as ReturnType<typeof vi.fn>

/** Record every invocation so a test can assert WHICH binary ran, not just what came back. */
const calls: { cmd: string; args: string[] }[] = []

/** Route the mock by command, so one setup serves apptainer + systemctl + docker in one test. */
function mockExec(handler: (cmd: string, args: string[]) => string | Error) {
  execMock().mockImplementation((cmd: string, args: string[], cb: ExecCb) => {
    calls.push({ cmd, args })
    const result = handler(cmd, args)
    if (result instanceof Error) cb(result)
    else cb(null, { stdout: result, stderr: '' })
  })
}

/** The common case: `instance list --json` returns this; anything else is an unexpected call. */
function mockApptainerList(stdout: string) {
  mockExec((cmd, args) => {
    if (args[0] === 'instance' && args[1] === 'list') return stdout
    return ''
  })
}

beforeEach(() => {
  // resetAllMocks, not clearAllMocks: clearAllMocks clears recorded CALLS but leaves the
  // implementation (and any `once` queue) in place, so a test that forgets to arrange its own exec
  // mock silently inherits the previous test's. Several assertions here are negative
  // ("never ran the binary"), and those are exactly the ones a stale implementation makes
  // meaningless without failing.
  vi.resetAllMocks()
  calls.length = 0
  setRegistry(makeRegistry({ logtest: INSTANCE_DEF, 'web-nginx': MICROVM_DEF }))
  setConfig(makeConfig())
})

// ── The /proc derivation ──────────────────────────────────────────────────────────────────────
// ── Real capture: `cat /proc/1634/stat` on king, 2026-08-04, verbatim ────────────────────────
// A live sshd, not a synthesised line. Provenance matters here for the same reason it did for the
// Apptainer JSON: a /proc fixture invented from the proc(5) man page does not fail when the field
// index is wrong — it agrees with whatever implementation was written alongside it.
//
// Ground truth for this exact pid, captured in the same command:
//   btime = 1785806483, field 22 = 1318 ticks  ->  1785806483 + 13.18 = 1785806496
//   `ps -o lstart= -p 1634` -> Mon Aug  3 21:21:36 2026 = 1785806496   MATCH
// Verified on a second process the same way (NetworkManager, pid 1382, 1278 ticks -> 1785806495,
// exact). Two matches to the second is also the empirical confirmation of USER_HZ = 100.
const REAL_STAT =
  '1634 (sshd) S 1 1634 1634 0 -1 4194560 1118 0 8 0 0 0 0 0 20 0 1 0 1318 12562432 1887 ' +
  '18446744073709551615 1 1 0 0 0 0 0 4096 81925 0 0 0 17 13 0 0 0 0 0 0 0 0 0 0 0 0 0'

// Real capture: the non-cpu tail of `/proc/stat` on king, same moment.
const REAL_PROC_STAT = [
  'cpu  1483846 17020 408807 138162102 72785 95435 80268 0 40223 0',
  'cpu0 45968 52 13673 4909010 1824 3379 33468 0 893 0',
  'btime 1785806483',
  'processes 322671',
  'procs_running 1',
].join('\n')

describe('parseProcStatStartTicks', () => {
  it('reads field 22 out of a real /proc/<pid>/stat line', () => {
    expect(parseProcStatStartTicks(REAL_STAT)).toBe(1318)
  })

  // The end-to-end check, against `ps` rather than against this implementation.
  it('reproduces the start time ps reports for the captured process', () => {
    const ticks = parseProcStatStartTicks(REAL_STAT)!
    const btime = parseProcBtime(REAL_PROC_STAT)!
    expect(Math.floor(btime + ticks / 100)).toBe(1785806496)
  })

  // The whole reason this parser exists rather than a `.split(' ')[21]`. Field 2 is the comm, in
  // parentheses, and it may contain BOTH spaces and parentheses — splitting from the left shifts
  // every later field by an amount that depends on the process's own name. A fixture with a
  // well-behaved comm passes either implementation, which is why this case is written explicitly.
  it('survives a comm containing spaces AND parentheses', () => {
    const nasty = REAL_STAT.replace('(sshd)', '(my prog (v2) beta)')
    expect(parseProcStatStartTicks(nasty)).toBe(1318)
    // And the naive implementation this guards against genuinely fails on it — a fixture whose
    // comm is well-behaved passes both, which is why the assertion below is here too.
    expect(nasty.split(/\s+/)[21]).not.toBe('1318')
  })

  it('returns null rather than throwing on unusable input', () => {
    for (const bad of ['', '   ', 'no parens here', '1234 (x) S', '6554 (x) S ' + 'a '.repeat(30)]) {
      expect(parseProcStatStartTicks(bad), bad).toBeNull()
    }
  })
})

describe('parseProcBtime', () => {
  it('reads btime out of a real /proc/stat', () => {
    expect(parseProcBtime(REAL_PROC_STAT)).toBe(1785806483)
  })

  it('returns null when btime is absent or unusable', () => {
    for (const bad of ['', 'cpu 1 2 3', 'btime\n', 'btime notanumber', 'btime 0']) {
      expect(parseProcBtime(bad), bad).toBeNull()
    }
  })

  // `btime` must not be matched inside another key's value or a longer key name.
  it('does not match a btime-like token mid-line', () => {
    expect(parseProcBtime('softirq 0 btime 999\ncpu 1')).toBeNull()
  })
})

// ── Status: presence, and only presence ───────────────────────────────────────────────────────
describe('Apptainer status dispatch', () => {
  it('reports running when the instance is present in the list', async () => {
    mockApptainerList(APPTAINER_LIST)
    expect(await getVmStatus('logtest')).toBe('running')
  })

  it('reports stopped — never failed — when the instance is absent', async () => {
    mockApptainerList(APPTAINER_EMPTY)
    const status = await getVmStatus('logtest')
    expect(status).toBe('stopped')
    // Apptainer keeps no stopped-instance record, so there is nothing that could justify `failed`.
    // Synthesising one would report a healthy, deliberately-stopped instance as broken.
    expect(status).not.toBe('failed')
  })

  it('reports unknown when the binary cannot be run — "could not ask" is not "not running"', async () => {
    mockExec(() => new Error('spawn /nix/store/abc-apptainer/bin/apptainer ENOENT'))
    expect(await getVmStatus('logtest')).toBe('unknown')
  })

  // THE regression this slice exists to prevent.
  it('never touches systemd for an Apptainer workload', async () => {
    mockApptainerList(APPTAINER_LIST)
    await getVmStatus('logtest')
    expect(calls.map(c => c.cmd)).not.toContain('systemctl')
    expect(calls.map(c => c.cmd)).not.toContain('sudo')
    expect(calls[0]!.cmd).toBe('/nix/store/abc-apptainer/bin/apptainer')
    expect(calls[0]!.args).toEqual(['instance', 'list', '--json'])
  })

  it('still routes a microvm workload to systemd — the widening did not capture VMs', async () => {
    mockExec(() => 'active\n')
    expect(await getVmStatus('web-nginx')).toBe('running')
    expect(calls[0]!.cmd).toBe('systemctl')
  })

  it('resolves the binary from config.apptainerBin, not a bare name', async () => {
    setConfig(makeConfig({ apptainerBin: '/custom/path/apptainer' }))
    mockApptainerList(APPTAINER_LIST)
    await getVmStatus('logtest')
    expect(calls[0]!.cmd).toBe('/custom/path/apptainer')
  })
})

// ── Uptime: derived from the pid, because there is nothing else ───────────────────────────────
describe('Apptainer uptime dispatch', () => {
  it('derives an ISO start time from btime + field 22', async () => {
    mockApptainerList(APPTAINER_LIST)
    readMock().mockImplementation((path: string) =>
      Promise.resolve(path === '/proc/stat' ? REAL_PROC_STAT : REAL_STAT),
    )
    // Same arithmetic `ps` agrees with above: 1785806483 + 1318/100 = 1785806496.18
    expect(await getVmUptime('logtest')).toBe('2026-08-04T01:21:36.180Z')
    // The pid comes from the instance list, not from the workload name — this is the only wiring
    // that connects the two calls, and it is silent when wrong (null uptime, no error).
    expect(readMock()).toHaveBeenCalledWith('/proc/6554/stat', 'utf-8')
  })

  it('returns null when the instance is not running — null is a valid answer here', async () => {
    mockApptainerList(APPTAINER_EMPTY)
    expect(await getVmUptime('logtest')).toBeNull()
    expect(readMock()).not.toHaveBeenCalled()
  })

  // The process can exit between the list and the read. That is an ordinary race on a daemonless
  // runtime, not an error to surface.
  it('returns null when /proc has already gone away', async () => {
    mockApptainerList(APPTAINER_LIST)
    readMock().mockRejectedValue(new Error('ENOENT: no such file or directory'))
    expect(await getVmUptime('logtest')).toBeNull()
  })

  it('returns null rather than a bogus date when /proc is unparseable', async () => {
    mockApptainerList(APPTAINER_LIST)
    readMock().mockResolvedValue('garbage')
    expect(await getVmUptime('logtest')).toBeNull()
  })
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────────────────────
describe('Apptainer lifecycle dispatch', () => {
  it('starts FROM the recorded image — apptainer instantiates, it does not resume', async () => {
    mockExec(() => '')
    const result = await startVm('logtest')
    expect(result.success).toBe(true)
    expect(calls[0]!.args).toEqual(['instance', 'start', APPTAINER_IMG, 'logtest'])
  })

  // docker/podman `start` needs only a name because the container exists on disk. Apptainer has
  // nothing to resume, so a def with no image is genuinely unstartable — and saying so beats
  // inventing a default path that would start the wrong thing.
  it('fails actionably when the image path was never recorded', async () => {
    setRegistry(makeRegistry({ orphan: { ...INSTANCE_DEF, name: 'orphan', image: undefined } }))
    mockExec(() => '')
    const result = await startVm('orphan')
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/image path unknown/i)
    expect(result.message).toMatch(/re-scan/i)
    expect(execMock()).not.toHaveBeenCalled()
  })

  it('stops by name', async () => {
    mockExec(() => '')
    const result = await stopVm('logtest')
    expect(result.success).toBe(true)
    expect(calls[0]!.args).toEqual(['instance', 'stop', 'logtest'])
  })

  it('restarts as stop-then-start — there is no `instance restart`', async () => {
    mockExec(() => '')
    const result = await restartVm('logtest')
    expect(result.success).toBe(true)
    expect(calls.map(c => c.args.slice(0, 2))).toEqual([
      ['instance', 'stop'],
      ['instance', 'start'],
    ])
  })

  it('reports the stop failure rather than starting over a name still in use', async () => {
    mockExec((_cmd, args) =>
      args[1] === 'stop' ? new Error('FATAL: no instance found') : '',
    )
    const result = await restartVm('logtest')
    expect(result.success).toBe(false)
    expect(calls.map(c => c.args[1])).toEqual(['stop'])
  })

  // G-security-2026-06-02-01KYSBXCJAHNA6GV0CQ15N1CXP — no raw exec error crosses the boundary.
  it('sanitizes failures: no store path, binary path or FATAL text in the message', async () => {
    mockExec(() => new Error(
      'Command failed: /nix/store/abc-apptainer/bin/apptainer instance start ...\n' +
      'FATAL:   container creation failed: mount /proc/self/fd/3->/var/lib/apptainer/mnt/session',
    ))
    for (const result of [await startVm('logtest'), await stopVm('logtest')]) {
      expect(result.success).toBe(false)
      expect(result.message).not.toMatch(/nix\/store/)
      expect(result.message).not.toMatch(/FATAL/)
      expect(result.message).not.toMatch(/\/proc\//)
      expect(result.message).toMatch(/Check server logs/)
    }
  })
})

// ── Scan ──────────────────────────────────────────────────────────────────────────────────────
describe('Apptainer scan', () => {
  it('registers a discovered instance with runtime and image', async () => {
    const reg = makeRegistry({})
    setRegistry(reg)
    mockApptainerList(APPTAINER_LIST)

    const result = await scanApptainerInstances()
    expect(result).toEqual({ discovered: ['logtest'], added: ['logtest'], existing: [] })

    const stored = await reg.get('logtest')
    expect(stored!.runtime).toBe('apptainer')
    expect(stored!.hypervisor).toBe('apptainer')
    expect(stored!.image).toBe(APPTAINER_IMG)
    // The pid changes on every start, so it is not an identity and must not be stored as one.
    expect(stored!.containerId).toBeUndefined()
  })

  it('marks an already-registered instance existing, not added', async () => {
    mockApptainerList(APPTAINER_LIST)
    const result = await scanApptainerInstances()
    expect(result.added).toEqual([])
    expect(result.existing).toEqual(['logtest'])
  })

  it('returns an empty result when apptainer is not installed — never an error', async () => {
    mockExec(() => new Error('spawn apptainer ENOENT'))
    await expect(scanApptainerInstances()).resolves.toEqual({ discovered: [], added: [], existing: [] })
  })

  // scanContainers is the one entry point the scan route maps over; apptainer must ride it.
  it('is reachable through scanContainers("apptainer")', async () => {
    mockApptainerList(APPTAINER_LIST)
    const result = await scanContainers('apptainer')
    expect(result.discovered).toEqual(['logtest'])
    expect(calls[0]!.args).toEqual(['instance', 'list', '--json'])
  })
})

// ── The WVR-206 tier gate: hidden below Solo, not nagged ──────────────────────────────────────
describe('Free tier hides Apptainer entirely (WVR-206)', () => {
  beforeEach(() => setConfig(makeConfig({ tier: 'free' })))

  // The primary control. Excluding at RENDER would leave the workload in the registry, and a
  // registered workload leaks through the `vm-status` broadcast — which is the exact failure
  // WVR-206 names when it says "excluded at scan, not at render".
  it('discovers nothing at scan, and never even runs the binary', async () => {
    const reg = makeRegistry({})
    setRegistry(reg)
    mockApptainerList(APPTAINER_LIST)

    const result = await scanApptainerInstances()
    expect(result).toEqual({ discovered: [], added: [], existing: [] })
    expect(execMock()).not.toHaveBeenCalled()
    expect(await reg.getAll()).toEqual({})
  })

  // Second half: a workload that reached the registry by another path (a tier downgrade after a
  // Solo-era scan, a hand-edited registry file) must not flow out through the list or the ws feed.
  it('omits an already-registered instance from listVms — the same list ws.ts broadcasts', async () => {
    mockExec(() => 'active\n')
    const names = (await listVms()).map(w => w.name)
    expect(names).toEqual(['web-nginx'])
    expect(names).not.toContain('logtest')
  })

  it('returns null from getVm — a 404, not a 403 that would advertise the feature', async () => {
    // The microvm half of this assertion reaches systemctl, so the exec mock has to be arranged
    // here rather than inherited — an un-implemented execFile mock never invokes its callback and
    // the promisified call hangs rather than failing.
    mockExec(() => 'active\n')
    expect(await getVm('logtest')).toBeNull()
    expect(await getVm('web-nginx')).not.toBeNull()
  })

  it('answers actions with "not found" — the same answer an unknown name gets', async () => {
    for (const action of [startVm, stopVm, restartVm]) {
      const result = await action('logtest')
      expect(result.success).toBe(false)
      expect(result.message).toMatch(/not found/)
      // Never the tier: "requires weaver tier" is precisely the nag WVR-206 refuses.
      expect(result.message).not.toMatch(/tier|upgrade|solo/i)
    }
    expect(execMock()).not.toHaveBeenCalled()
  })

  // An indeterminate tier must not serve a gated feature. Every other config read in this service
  // falls back to a harmless default; the tier check is the one that has to fail closed.
  it('fails CLOSED when no config is set at all', async () => {
    setConfig(undefined as unknown as DashboardConfig)
    mockApptainerList(APPTAINER_LIST)
    expect(await scanApptainerInstances()).toEqual({ discovered: [], added: [], existing: [] })
    expect(await getVm('logtest')).toBeNull()
  })

  it('does not hide docker or podman workloads — the gate is Apptainer-specific', async () => {
    setRegistry(makeRegistry({
      'my-nginx': { name: 'my-nginx', ip: '', mem: 0, vcpu: 0, hypervisor: 'docker', runtime: 'docker' },
      logtest: INSTANCE_DEF,
    }))
    mockExec(() => 'running\n')
    expect((await listVms()).map(w => w.name)).toEqual(['my-nginx'])
  })
})
