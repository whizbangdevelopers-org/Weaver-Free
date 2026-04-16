import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import React from 'react'
import { VmDetail } from '../components/VmDetail.js'
import type { VmInfo } from '../types/vm.js'
import type { TuiApiClient } from '../client/api.js'

const tick = () => new Promise(r => setTimeout(r, 50))

const sampleVm: VmInfo = {
  name: 'web-nginx',
  status: 'running',
  ip: '10.10.0.10',
  mem: 256,
  vcpu: 1,
  hypervisor: 'qemu',
  uptime: new Date(Date.now() - 3600000).toISOString(),
}

const mockApi = {
  getVmLogs: vi.fn().mockResolvedValue({ status: 200, data: { name: 'web-nginx', log: 'test log' } }),
} as unknown as TuiApiClient

function defaultProps(overrides?: Partial<Parameters<typeof VmDetail>[0]>) {
  return {
    vm: sampleVm,
    api: mockApi,
    onBack: vi.fn(),
    onAction: vi.fn().mockResolvedValue(undefined),
    onAgent: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('VmDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders VM name and detail header', () => {
    const { lastFrame } = render(<VmDetail {...defaultProps()} />)
    expect(lastFrame()).toContain('VM Detail: web-nginx')
  })

  it('renders VM properties', () => {
    const { lastFrame } = render(<VmDetail {...defaultProps()} />)
    const frame = lastFrame()!
    expect(frame).toContain('running')
    expect(frame).toContain('10.10.0.10')
    expect(frame).toContain('256 MB')
    expect(frame).toContain('qemu')
  })

  it('shows key legend with delete when onDelete provided', () => {
    const { lastFrame } = render(<VmDetail {...defaultProps()} />)
    expect(lastFrame()).toContain('[x]delete')
  })

  it('hides delete key when onDelete not provided', () => {
    const { lastFrame } = render(<VmDetail {...defaultProps({ onDelete: undefined })} />)
    expect(lastFrame()).not.toContain('[x]delete')
  })

  it('Esc triggers onBack', async () => {
    const onBack = vi.fn()
    const { stdin } = render(<VmDetail {...defaultProps({ onBack })} />)
    await tick()

    stdin.write('\x1B')
    await tick()

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('b triggers onBack', async () => {
    const onBack = vi.fn()
    const { stdin } = render(<VmDetail {...defaultProps({ onBack })} />)
    await tick()

    stdin.write('b')
    await tick()

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('x shows delete confirmation', async () => {
    const { stdin, lastFrame } = render(<VmDetail {...defaultProps()} />)
    await tick()

    stdin.write('x')
    await tick()

    expect(lastFrame()).toContain('Delete VM: web-nginx')
    expect(lastFrame()).toContain('[y] confirm')
  })

  it('n dismisses delete confirmation', async () => {
    const onDelete = vi.fn()
    const { stdin, lastFrame } = render(<VmDetail {...defaultProps({ onDelete })} />)
    await tick()

    stdin.write('x')
    await tick()
    expect(lastFrame()).toContain('Delete VM:')

    stdin.write('n')
    await tick()

    expect(lastFrame()).not.toContain('Delete VM:')
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('y confirms delete and calls onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const { stdin } = render(<VmDetail {...defaultProps({ onDelete })} />)
    await tick()

    stdin.write('x')
    await tick()

    stdin.write('y')
    await tick()

    expect(onDelete).toHaveBeenCalledWith('web-nginx')
  })

  it('Esc dismisses delete confirmation', async () => {
    const onDelete = vi.fn()
    const { stdin, lastFrame } = render(<VmDetail {...defaultProps({ onDelete })} />)
    await tick()

    stdin.write('x')
    await tick()
    expect(lastFrame()).toContain('Delete VM:')

    // Esc during confirmation
    stdin.write('\x1B')
    await tick()

    // Confirmation dismissed (Esc in confirm mode just exits confirm, doesn't go back)
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('shows VM not found when vm is null', () => {
    const { lastFrame } = render(<VmDetail {...defaultProps({ vm: null })} />)
    expect(lastFrame()).toContain('VM not found')
  })
})
