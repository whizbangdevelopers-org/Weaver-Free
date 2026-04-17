// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkloadRegistry, WorkloadDefinition } from '../../src/storage/workload-registry.js'

vi.mock('node:child_process', () => ({
  execFile: vi.fn()
}))

import { execFile } from 'node:child_process'
import {
  getVmStatus,
  getVmUptime,
  listVms,
  getVm,
  startVm,
  stopVm,
  restartVm,
  getWorkloadDefinitions,
  scanContainers,
  setRegistry
} from '../../src/services/microvm.js'

// In-memory mock registry
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

const MICROVM_FIXTURES: Record<string, WorkloadDefinition> = {
  'web-nginx':   { name: 'web-nginx',   ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu', distro: 'nixos' },
  'web-app':     { name: 'web-app',     ip: '10.10.0.11', mem: 512, vcpu: 1, hypervisor: 'qemu', distro: 'nixos' },
  'dev-node':    { name: 'dev-node',    ip: '10.10.0.20', mem: 512, vcpu: 1, hypervisor: 'qemu', distro: 'nixos' },
  'dev-python':  { name: 'dev-python',  ip: '10.10.0.21', mem: 512, vcpu: 1, hypervisor: 'qemu', distro: 'nixos' },
  'svc-postgres':{ name: 'svc-postgres',ip: '10.10.0.30', mem: 512, vcpu: 1, hypervisor: 'qemu', distro: 'nixos' },
}

const CONTAINER_FIXTURES: Record<string, WorkloadDefinition> = {
  'my-nginx':  { name: 'my-nginx',  ip: '', mem: 0, vcpu: 0, hypervisor: 'docker', runtime: 'docker', containerId: 'abc123', image: 'nginx:latest' },
  'my-db':     { name: 'my-db',     ip: '', mem: 0, vcpu: 0, hypervisor: 'podman', runtime: 'podman', containerId: 'def456', image: 'postgres:15' },
}

function createMockRegistry(): WorkloadRegistry { return makeRegistry(MICROVM_FIXTURES) }
function createMockRegistryWithContainers(): WorkloadRegistry {
  return makeRegistry({ ...MICROVM_FIXTURES, ...CONTAINER_FIXTURES })
}

// Helper to set up execFile mock responses
function mockExecFile(stdout: string) {
  const cb = (_err: unknown, result: { stdout: string; stderr: string }) => result
  ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (_cmd: string, _args: string[], callback: typeof cb) => {
      callback(null, { stdout, stderr: '' })
    }
  )
}

function mockExecFileError(error: Error) {
  ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (_cmd: string, _args: string[], callback: (err: Error) => void) => {
      callback(error)
    }
  )
}

function _mockExecFileSequence(responses: Array<string | Error>) {
  let call = 0
  ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (_cmd: string, _args: string[], callback: (err: Error | null, result?: { stdout: string; stderr: string }) => void) => {
      const response = responses[call++] ?? ''
      if (response instanceof Error) {
        callback(response)
      } else {
        callback(null, { stdout: response, stderr: '' })
      }
    }
  )
}

describe('MicroVM Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRegistry(createMockRegistry())
  })

  describe('getWorkloadDefinitions', () => {
    it('should return all 5 VM definitions', async () => {
      const defs = await getWorkloadDefinitions()
      expect(Object.keys(defs)).toHaveLength(5)
      expect(defs['web-nginx']).toMatchObject({
        name: 'web-nginx', ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu'
      })
      expect(defs['svc-postgres']).toMatchObject({
        name: 'svc-postgres', ip: '10.10.0.30', mem: 512, vcpu: 1, hypervisor: 'qemu'
      })
    })
  })

  describe('getVmStatus', () => {
    it('should return running for active service', async () => {
      mockExecFile('active\n')
      const status = await getVmStatus('web-nginx')
      expect(status).toBe('running')
    })

    it('should return stopped for inactive+enabled service (anomalous stop)', async () => {
      // is-active → inactive, is-enabled → enabled: unit should be running but isn't
      const mock = execFile as unknown as ReturnType<typeof vi.fn>
      mock.mockImplementationOnce((_c: string, _a: string[], cb: (e: null, r: { stdout: string; stderr: string }) => void) => cb(null, { stdout: 'inactive\n', stderr: '' }))
      mock.mockImplementationOnce((_c: string, _a: string[], cb: (e: null, r: { stdout: string; stderr: string }) => void) => cb(null, { stdout: 'enabled\n', stderr: '' }))
      const status = await getVmStatus('web-nginx')
      expect(status).toBe('stopped')
    })

    it('should return idle for inactive+disabled service (intentional stop)', async () => {
      // is-active → inactive, is-enabled → disabled: operator intentionally parked it
      const mock = execFile as unknown as ReturnType<typeof vi.fn>
      mock.mockImplementationOnce((_c: string, _a: string[], cb: (e: null, r: { stdout: string; stderr: string }) => void) => cb(null, { stdout: 'inactive\n', stderr: '' }))
      mock.mockImplementationOnce((_c: string, _a: string[], cb: (e: null, r: { stdout: string; stderr: string }) => void) => cb(null, { stdout: 'disabled\n', stderr: '' }))
      const status = await getVmStatus('web-nginx')
      expect(status).toBe('idle')
    })

    it('should return failed for failed service', async () => {
      mockExecFile('failed\n')
      const status = await getVmStatus('web-nginx')
      expect(status).toBe('failed')
    })

    it('should return unknown for unrecognized status', async () => {
      mockExecFile('activating\n')
      const status = await getVmStatus('web-nginx')
      expect(status).toBe('unknown')
    })

    it('should return unknown when command fails entirely', async () => {
      // systemctl not found or permission denied — status is indeterminate
      mockExecFileError(new Error('unit not found'))
      const status = await getVmStatus('nonexistent')
      expect(status).toBe('unknown')
    })
  })

  describe('getVmUptime', () => {
    it('should return timestamp string', async () => {
      mockExecFile('Thu 2026-01-01 12:00:00 UTC\n')
      const uptime = await getVmUptime('web-nginx')
      expect(uptime).toBe('Thu 2026-01-01 12:00:00 UTC')
    })

    it('should return null for empty timestamp', async () => {
      mockExecFile('\n')
      const uptime = await getVmUptime('web-nginx')
      expect(uptime).toBeNull()
    })

    it('should return null on error', async () => {
      mockExecFileError(new Error('failed'))
      const uptime = await getVmUptime('web-nginx')
      expect(uptime).toBeNull()
    })
  })

  describe('getVm', () => {
    it('should return VM info for known VM', async () => {
      mockExecFile('active\n')
      const vm = await getVm('web-nginx')
      expect(vm).not.toBeNull()
      expect(vm!.name).toBe('web-nginx')
      expect(vm!.ip).toBe('10.10.0.10')
      expect(vm!.status).toBe('running')
    })

    it('should return null for unknown VM', async () => {
      const vm = await getVm('nonexistent-vm')
      expect(vm).toBeNull()
    })
  })

  describe('listVms', () => {
    it('should return all 5 VMs with status', async () => {
      mockExecFile('inactive\n')
      const vms = await listVms()
      expect(vms).toHaveLength(5)
      expect(vms.map(v => v.name).sort()).toEqual([
        'dev-node', 'dev-python', 'svc-postgres', 'web-app', 'web-nginx'
      ])
    })
  })

  describe('startVm', () => {
    it('should succeed for known VM', async () => {
      let callCount = 0
      ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, args: string[], callback: (err: unknown, result: { stdout: string; stderr: string }) => void) => {
          callCount++
          // First call: systemctl start (no output), second call: is-active check
          const stdout = callCount === 1 ? '' : 'active\n'
          callback(null, { stdout, stderr: '' })
        }
      )
      const result = await startVm('web-nginx')
      expect(result.success).toBe(true)
      expect(result.message).toContain('web-nginx')
    })

    it('should fail for unknown VM', async () => {
      const result = await startVm('nonexistent')
      expect(result.success).toBe(false)
      expect(result.message).toContain('not found')
    })

    it('should handle command errors', async () => {
      mockExecFileError(new Error('Permission denied'))
      const result = await startVm('web-nginx')
      expect(result.success).toBe(false)
      expect(result.message).toContain('Check server logs')
    })
  })

  describe('stopVm', () => {
    it('should succeed for known VM', async () => {
      mockExecFile('')
      const result = await stopVm('web-app')
      expect(result.success).toBe(true)
      expect(result.message).toContain('web-app')
    })

    it('should fail for unknown VM', async () => {
      const result = await stopVm('nonexistent')
      expect(result.success).toBe(false)
    })
  })

  describe('restartVm', () => {
    it('should succeed for known VM', async () => {
      let callCount = 0
      ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, args: string[], callback: (err: unknown, result: { stdout: string; stderr: string }) => void) => {
          callCount++
          const stdout = callCount === 1 ? '' : 'active\n'
          callback(null, { stdout, stderr: '' })
        }
      )
      const result = await restartVm('dev-node')
      expect(result.success).toBe(true)
      expect(result.message).toContain('dev-node')
    })

    it('should fail for unknown VM', async () => {
      const result = await restartVm('nonexistent')
      expect(result.success).toBe(false)
    })
  })

})

describe('Container dispatch (docker/podman)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRegistry(createMockRegistryWithContainers())
  })

  describe('getVmStatus — container entries', () => {
    it('returns running when inspect reports running (docker)', async () => {
      mockExecFile('running\n')
      expect(await getVmStatus('my-nginx')).toBe('running')
    })

    it('returns stopped when inspect reports exited (docker)', async () => {
      mockExecFile('exited\n')
      expect(await getVmStatus('my-nginx')).toBe('stopped')
    })

    it('returns idle when inspect reports paused (docker)', async () => {
      mockExecFile('paused\n')
      expect(await getVmStatus('my-nginx')).toBe('idle')
    })

    it('returns failed when inspect reports dead (docker)', async () => {
      mockExecFile('dead\n')
      expect(await getVmStatus('my-nginx')).toBe('failed')
    })

    it('returns unknown when inspect reports an unrecognized state (docker)', async () => {
      mockExecFile('restarting\n')
      expect(await getVmStatus('my-nginx')).toBe('unknown')
    })

    it('returns unknown when inspect command fails (docker)', async () => {
      mockExecFileError(new Error('docker: command not found'))
      expect(await getVmStatus('my-nginx')).toBe('unknown')
    })

    it('dispatches to podman for podman-runtime entries', async () => {
      mockExecFile('running\n')
      expect(await getVmStatus('my-db')).toBe('running')
    })
  })

  describe('getVmUptime — container entries', () => {
    it('returns StartedAt timestamp (docker)', async () => {
      mockExecFile('2026-03-20T10:00:00.000Z\n')
      expect(await getVmUptime('my-nginx')).toBe('2026-03-20T10:00:00.000Z')
    })

    it('returns null when inspect returns empty string (docker)', async () => {
      mockExecFile('\n')
      expect(await getVmUptime('my-nginx')).toBeNull()
    })

    it('returns null when inspect command fails (docker)', async () => {
      mockExecFileError(new Error('no such container'))
      expect(await getVmUptime('my-nginx')).toBeNull()
    })
  })

  describe('startVm — container dispatch', () => {
    it('starts a docker container successfully', async () => {
      mockExecFile('')
      const result = await startVm('my-nginx')
      expect(result.success).toBe(true)
      expect(result.message).toContain('my-nginx')
    })

    it('returns failure when docker start command errors', async () => {
      mockExecFileError(new Error('no such container'))
      const result = await startVm('my-nginx')
      expect(result.success).toBe(false)
      expect(result.message).toContain('Check server logs')
    })

    it('starts a podman container successfully', async () => {
      mockExecFile('')
      const result = await startVm('my-db')
      expect(result.success).toBe(true)
      expect(result.message).toContain('my-db')
    })
  })

  describe('stopVm — container dispatch', () => {
    it('stops a docker container successfully', async () => {
      mockExecFile('')
      const result = await stopVm('my-nginx')
      expect(result.success).toBe(true)
      expect(result.message).toContain('my-nginx')
    })

    it('returns failure when podman stop command errors', async () => {
      mockExecFileError(new Error('container not running'))
      const result = await stopVm('my-db')
      expect(result.success).toBe(false)
      expect(result.message).toContain('Check server logs')
    })
  })

  describe('restartVm — container dispatch', () => {
    it('restarts a docker container successfully', async () => {
      mockExecFile('')
      const result = await restartVm('my-nginx')
      expect(result.success).toBe(true)
      expect(result.message).toContain('my-nginx')
    })

    it('restarts a podman container successfully', async () => {
      mockExecFile('')
      const result = await restartVm('my-db')
      expect(result.success).toBe(true)
      expect(result.message).toContain('my-db')
    })
  })
})

describe('scanContainers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRegistry(makeRegistry({ 'my-nginx': CONTAINER_FIXTURES['my-nginx']! }))
  })

  describe('docker', () => {
    it('discovers new containers and marks existing ones', async () => {
      const psOutput = [
        JSON.stringify({ ID: 'abc123', Names: 'my-nginx', Image: 'nginx:latest', State: 'running', Ports: '' }),
        JSON.stringify({ ID: 'xyz789', Names: 'new-app',  Image: 'redis:7',      State: 'exited',  Ports: '0.0.0.0:6379->6379/tcp' }),
      ].join('\n')
      mockExecFile(psOutput)

      const result = await scanContainers('docker')
      expect(result.discovered).toEqual(['my-nginx', 'new-app'])
      expect(result.added).toEqual(['new-app'])
      expect(result.existing).toEqual(['my-nginx'])
    })

    it('strips leading slash from Docker container names', async () => {
      const psOutput = JSON.stringify({ ID: 'abc', Names: '/slashed-name', Image: 'alpine', State: 'running', Ports: '' })
      mockExecFile(psOutput)

      const result = await scanContainers('docker')
      expect(result.discovered).toEqual(['slashed-name'])
      expect(result.added).toEqual(['slashed-name'])
    })

    it('stores image, containerId, and ports on new containers', async () => {
      const reg = makeRegistry({})
      setRegistry(reg)
      const psOutput = JSON.stringify({ ID: 'abc123', Names: 'my-app', Image: 'nginx:latest', State: 'running', Ports: '0.0.0.0:8080->80/tcp, 0.0.0.0:8443->443/tcp' })
      mockExecFile(psOutput)

      await scanContainers('docker')
      const stored = await reg.get('my-app')
      expect(stored).not.toBeNull()
      expect(stored!.runtime).toBe('docker')
      expect(stored!.containerId).toBe('abc123')
      expect(stored!.image).toBe('nginx:latest')
      expect(stored!.ports).toEqual(['0.0.0.0:8080->80/tcp', '0.0.0.0:8443->443/tcp'])
    })

    it('returns empty result when docker is not installed', async () => {
      mockExecFileError(new Error('docker: No such file or directory'))
      const result = await scanContainers('docker')
      expect(result).toEqual({ discovered: [], added: [], existing: [] })
    })

    it('returns empty result when ps output is empty', async () => {
      mockExecFile('')
      const result = await scanContainers('docker')
      expect(result).toEqual({ discovered: [], added: [], existing: [] })
    })

    it('skips malformed JSON lines without throwing', async () => {
      const psOutput = [
        'not-valid-json',
        JSON.stringify({ ID: 'abc', Names: 'good-container', Image: 'alpine', State: 'running', Ports: '' }),
      ].join('\n')
      mockExecFile(psOutput)

      const result = await scanContainers('docker')
      expect(result.discovered).toEqual(['good-container'])
    })
  })

  describe('podman', () => {
    it('discovers podman containers and sets runtime: podman', async () => {
      const reg = makeRegistry({})
      setRegistry(reg)
      const psOutput = JSON.stringify({ ID: 'pod111', Names: 'my-svc', Image: 'postgres:15', State: 'running', Ports: '' })
      mockExecFile(psOutput)

      const result = await scanContainers('podman')
      expect(result.added).toEqual(['my-svc'])

      const stored = await reg.get('my-svc')
      expect(stored!.runtime).toBe('podman')
      expect(stored!.containerId).toBe('pod111')
    })

    it('returns empty result when podman is not installed', async () => {
      mockExecFileError(new Error('podman: No such file or directory'))
      const result = await scanContainers('podman')
      expect(result).toEqual({ discovered: [], added: [], existing: [] })
    })
  })
})
