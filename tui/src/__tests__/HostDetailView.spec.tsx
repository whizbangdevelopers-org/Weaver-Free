import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import React from 'react'
import { HostDetailView } from '../components/weaver/HostDetailView.js'

const tick = () => new Promise(r => setTimeout(r, 50))

const mockHealthHost = {
  hostname: 'testbox',
  ipAddress: '192.168.1.10',
  arch: 'x86_64',
  cpuModel: 'AMD EPYC',
  cpuCount: 8,
  totalMemMb: 16384,
  kernelVersion: '6.18.8',
  uptimeSeconds: 86400,
  kvmAvailable: true,
}

const mockDetailed = {
  nixosVersion: '25.11',
  cpuTopology: { sockets: 1, coresPerSocket: 4, threadsPerCore: 2 },
  diskUsage: [{
    filesystem: '/dev/sda1', sizeHuman: '100G', usedHuman: '40G',
    availHuman: '60G', usePercent: 40, mountPoint: '/',
  }],
  networkInterfaces: [{ name: 'eth0', state: 'UP', macAddress: 'aa:bb:cc:dd:ee:ff' }],
  liveMetrics: { freeMemMb: 8192, loadAvg1: 0.5, loadAvg5: 0.3, loadAvg15: 0.2 },
}

function mockApi(overrides?: Record<string, unknown>) {
  return {
    getHealth: vi.fn().mockResolvedValue({
      status: 200,
      data: { host: mockHealthHost },
    }),
    getHostInfo: vi.fn().mockResolvedValue({
      status: 200,
      data: mockDetailed,
    }),
    ...overrides,
  } as unknown as Parameters<typeof HostDetailView>[0]['api']
}

describe('HostDetailView', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  // --- Free tier: basic info renders, detailed does NOT ---
  it('free tier shows basic host info from health', async () => {
    const api = mockApi()
    const { lastFrame } = render(
      <HostDetailView api={api} tier="free" onBack={vi.fn()} />
    )
    await tick()
    expect(lastFrame()).toContain('testbox')
    expect(lastFrame()).toContain('AMD EPYC')
    expect(lastFrame()).toContain('KVM')
  })

  it('free tier shows weaver upgrade hint', async () => {
    const api = mockApi()
    const { lastFrame } = render(
      <HostDetailView api={api} tier="free" onBack={vi.fn()} />
    )
    await tick()
    expect(lastFrame()).toContain('Weaver Solo')
    expect(lastFrame()).toContain('CPU topology')
  })

  it('free tier does NOT call getHostInfo', async () => {
    const api = mockApi()
    render(<HostDetailView api={api} tier="free" onBack={vi.fn()} />)
    await tick()
    expect(api.getHostInfo).not.toHaveBeenCalled()
  })

  // --- Weaver Solo tier: both sections render ---
  it('premium tier shows detailed sections', async () => {
    const api = mockApi()
    const { lastFrame } = render(
      <HostDetailView api={api} tier="weaver" onBack={vi.fn()} />
    )
    await tick()
    expect(lastFrame()).toContain('CPU Topology')
    expect(lastFrame()).toContain('Disk Usage')
    expect(lastFrame()).toContain('Live Metrics')
    expect(lastFrame()).toContain('25.11')
  })

  it('premium tier calls getHostInfo', async () => {
    const api = mockApi()
    render(<HostDetailView api={api} tier="weaver" onBack={vi.fn()} />)
    await tick()
    expect(api.getHostInfo).toHaveBeenCalledOnce()
  })

  // --- Demo tier: treated as weaver ---
  it('demo tier shows detailed sections', async () => {
    const api = mockApi()
    const { lastFrame } = render(
      <HostDetailView api={api} tier="demo" onBack={vi.fn()} />
    )
    await tick()
    expect(lastFrame()).toContain('CPU Topology')
  })

  // --- Loading / error states ---
  it('shows loading state', () => {
    const api = mockApi({ getHealth: vi.fn().mockReturnValue(new Promise(() => {})) })
    const { lastFrame } = render(
      <HostDetailView api={api} tier="free" onBack={vi.fn()} />
    )
    expect(lastFrame()).toContain('Loading host info')
  })

  it('shows error when health fails', async () => {
    const api = mockApi({
      getHealth: vi.fn().mockResolvedValue({ status: 500, data: null }),
    })
    const { lastFrame } = render(
      <HostDetailView api={api} tier="free" onBack={vi.fn()} />
    )
    await tick()
    expect(lastFrame()).toContain('Host info unavailable')
  })

  // --- Navigation ---
  it('Esc calls onBack', async () => {
    const onBack = vi.fn()
    const api = mockApi()
    const { stdin } = render(
      <HostDetailView api={api} tier="free" onBack={onBack} />
    )
    await tick()
    stdin.write('\x1B')
    await tick()
    expect(onBack).toHaveBeenCalled()
  })

  it('b key calls onBack', async () => {
    const onBack = vi.fn()
    const api = mockApi()
    const { stdin } = render(
      <HostDetailView api={api} tier="free" onBack={onBack} />
    )
    await tick()
    stdin.write('b')
    await tick()
    expect(onBack).toHaveBeenCalled()
  })
})
