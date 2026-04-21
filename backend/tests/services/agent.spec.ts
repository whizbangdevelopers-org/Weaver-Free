// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

// Import vi above any vi.mock/vi.hoisted usage so static analyzers see the
// binding. Vitest's transform still hoists these calls above the imports at
// runtime, so placement order in source is a static-analysis concern only.
import { vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getWorkloadDefinitions: vi.fn().mockResolvedValue({
    'web-nginx': { ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu' },
  }),
  getVmStatus: vi.fn().mockResolvedValue('running'),
  getConfig: vi.fn().mockReturnValue({ systemctlBin: 'systemctl' }),
}))

vi.mock('../../src/services/microvm.js', () => mocks)

vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (err: null, stdout: string, stderr: string) => void) =>
    cb(null, 'mock output', ''),
  ),
}))

vi.mock('../../src/services/llm-provider.js', () => ({
  resolveProvider: vi.fn().mockReturnValue(null),
  getDefaultModel: vi.fn().mockReturnValue('claude-test'),
}))

vi.mock('../../src/services/mock-agent.js', () => ({
  runMockAgent: vi.fn().mockResolvedValue(undefined),
}))

import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildPrompt,
  getOperation,
  hasActiveOperation,
  runAgent,
} from '../../src/services/agent.js'
import { runMockAgent } from '../../src/services/mock-agent.js'
import { resolveProvider } from '../../src/services/llm-provider.js'
import { STATUSES } from '../../src/constants/vocabularies.js'

const SAMPLE_CONTEXT = {
  vmName: 'web-nginx',
  vmDefinition: { ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu' },
  systemctlStatus: 'active (running) since 2026-01-01',
  journalLogs: 'Jan 01 started nginx.service',
  currentStatus: STATUSES.RUNNING,
}

describe('buildPrompt()', () => {
  it('contains the VM name', () => {
    const prompt = buildPrompt('diagnose', SAMPLE_CONTEXT)
    expect(prompt).toContain('web-nginx')
  })

  it('contains IP, memory, and vCPU from context', () => {
    const prompt = buildPrompt('diagnose', SAMPLE_CONTEXT)
    expect(prompt).toContain('10.10.0.10')
    expect(prompt).toContain('256')
    expect(prompt).toContain('1')
  })

  it('includes the systemctl status output', () => {
    const prompt = buildPrompt('diagnose', SAMPLE_CONTEXT)
    expect(prompt).toContain('active (running) since 2026-01-01')
  })

  it('includes journal logs', () => {
    const prompt = buildPrompt('diagnose', SAMPLE_CONTEXT)
    expect(prompt).toContain('Jan 01 started nginx.service')
  })

  describe('action-specific instructions', () => {
    it('diagnose — includes diagnose instruction', () => {
      const prompt = buildPrompt('diagnose', SAMPLE_CONTEXT)
      expect(prompt.toLowerCase()).toContain('diagnose')
    })

    it('explain — includes explain instruction', () => {
      const prompt = buildPrompt('explain', SAMPLE_CONTEXT)
      expect(prompt.toLowerCase()).toContain('explain')
    })

    it('suggest — includes suggest/optimiz instruction', () => {
      const prompt = buildPrompt('suggest', SAMPLE_CONTEXT)
      // The suggest branch uses the word "Suggest" and "optimizations"
      expect(prompt).toMatch(/suggest|optimiz/i)
    })

    it('each action produces a different prompt suffix', () => {
      const diagnose = buildPrompt('diagnose', SAMPLE_CONTEXT)
      const explain = buildPrompt('explain', SAMPLE_CONTEXT)
      const suggest = buildPrompt('suggest', SAMPLE_CONTEXT)
      expect(diagnose).not.toBe(explain)
      expect(explain).not.toBe(suggest)
      expect(diagnose).not.toBe(suggest)
    })
  })
})

describe('getOperation()', () => {
  it('returns undefined for an unknown operation ID', () => {
    expect(getOperation('non-existent-uuid')).toBeUndefined()
  })
})

describe('hasActiveOperation()', () => {
  it('returns false for an unknown VM name', () => {
    expect(hasActiveOperation('no-such-vm')).toBe(false)
  })
})

describe('runAgent()', () => {
  const broadcast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getWorkloadDefinitions.mockResolvedValue({
      'web-nginx': { ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu' },
    })
    mocks.getVmStatus.mockResolvedValue('running')
    vi.mocked(resolveProvider).mockReturnValue(null)
    vi.mocked(runMockAgent).mockResolvedValue(undefined)
  })

  it('returns an operationId string', async () => {
    const id = await runAgent({ vmName: 'web-nginx', action: 'diagnose', broadcast })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns a UUID-format operationId', async () => {
    const id = await runAgent({ vmName: 'web-nginx', action: 'diagnose', broadcast })
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('creates an operation retrievable via getOperation()', async () => {
    const id = await runAgent({ vmName: 'web-nginx', action: 'diagnose', broadcast })
    const op = getOperation(id)
    expect(op).toBeDefined()
    expect(op?.operationId).toBe(id)
    expect(op?.vmName).toBe('web-nginx')
    expect(op?.action).toBe('diagnose')
  })

  it('stores the operation (status is running or complete, never missing)', async () => {
    // runMockAgent is mocked to resolve immediately so by the time we await
    // runAgent, the fire-and-forget may have already completed. We verify the
    // operation is present and has a valid terminal state.
    const id = await runAgent({ vmName: 'web-nginx', action: 'explain', broadcast })
    const op = getOperation(id)
    expect(op).toBeDefined()
    expect([STATUSES.RUNNING, 'complete', 'error']).toContain(op?.status)
  })

  it('stores the operation with a startedAt timestamp', async () => {
    const id = await runAgent({ vmName: 'web-nginx', action: 'suggest', broadcast })
    const op = getOperation(id)
    expect(op?.startedAt).toBeDefined()
    expect(new Date(op!.startedAt).getTime()).toBeGreaterThan(0)
  })

  it('uses mock agent when provider resolves to null', async () => {
    vi.mocked(resolveProvider).mockReturnValue(null)
    await runAgent({ vmName: 'web-nginx', action: 'diagnose', broadcast })
    expect(runMockAgent).toHaveBeenCalled()
  })

  it('passes operationId, vmName, action, and broadcast to runMockAgent', async () => {
    vi.mocked(resolveProvider).mockReturnValue(null)
    const id = await runAgent({ vmName: 'web-nginx', action: 'diagnose', broadcast })
    expect(runMockAgent).toHaveBeenCalledWith(id, 'web-nginx', 'diagnose', broadcast)
  })

  it('successive calls for same VM replace the active operation tracking', async () => {
    vi.mocked(resolveProvider).mockReturnValue(null)
    const id1 = await runAgent({ vmName: 'web-nginx', action: 'diagnose', broadcast })
    const id2 = await runAgent({ vmName: 'web-nginx', action: 'explain', broadcast })
    // Both operations should be retrievable
    expect(getOperation(id1)).toBeDefined()
    expect(getOperation(id2)).toBeDefined()
    // The second should be the newer one
    expect(id1).not.toBe(id2)
  })

  it('different VMs get independent operation IDs', async () => {
    mocks.getWorkloadDefinitions.mockResolvedValue({
      'web-nginx': { ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu' },
      'web-app': { ip: '10.10.0.11', mem: 512, vcpu: 1, hypervisor: 'qemu' },
    })
    const id1 = await runAgent({ vmName: 'web-nginx', action: 'diagnose', broadcast })
    const id2 = await runAgent({ vmName: 'web-app', action: 'diagnose', broadcast })
    expect(id1).not.toBe(id2)
    expect(getOperation(id1)?.vmName).toBe('web-nginx')
    expect(getOperation(id2)?.vmName).toBe('web-app')
  })
})
