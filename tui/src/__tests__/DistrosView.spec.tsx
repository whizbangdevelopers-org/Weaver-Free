import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import React from 'react'
import { DistrosView } from '../components/DistrosView.js'

const tick = () => new Promise(r => setTimeout(r, 50))

const mockDistros = [
  { name: 'nixos', label: 'NixOS', url: 'https://example.com/nixos.qcow2',
    format: 'qcow2', cloudInit: false, guestOs: 'linux', builtin: true, category: 'builtin' },
  { name: 'ubuntu-24.04', label: 'Ubuntu 24.04 LTS', url: 'https://example.com/ubuntu.img',
    format: 'qcow2', cloudInit: true, guestOs: 'linux', builtin: true, category: 'builtin' },
  { name: 'custom-corp', label: 'Corp Build', url: 'file:///data/corp.qcow2',
    format: 'qcow2', cloudInit: false, guestOs: 'linux', builtin: false, category: 'custom' },
]

function mockApi(overrides?: Partial<{ listDistros: () => Promise<unknown> }>) {
  return {
    listDistros: vi.fn().mockResolvedValue({ status: 200, data: mockDistros }),
    ...overrides,
  } as unknown as Parameters<typeof DistrosView>[0]['api']
}

describe('DistrosView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders title', async () => {
    const { lastFrame } = render(<DistrosView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()
    expect(lastFrame()).toContain('Distro Catalog')
  })

  it('renders distro names', async () => {
    const { lastFrame } = render(<DistrosView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()
    const frame = lastFrame()!
    expect(frame).toContain('nixos')
    expect(frame).toContain('ubuntu-24.04')
    expect(frame).toContain('custom-corp')
  })

  it('renders column headers', async () => {
    const { lastFrame } = render(<DistrosView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()
    const frame = lastFrame()!
    expect(frame).toContain('NAME')
    expect(frame).toContain('LABEL')
    expect(frame).toContain('FORMAT')
    expect(frame).toContain('CLOUD-INIT')
  })

  it('shows number keys in legend', async () => {
    const { lastFrame } = render(<DistrosView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()
    expect(lastFrame()).toContain('[1-3] select')
  })

  it('number key selects distro detail', async () => {
    const { stdin, lastFrame } = render(<DistrosView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()

    stdin.write('2')
    await tick()

    const frame = lastFrame()!
    expect(frame).toContain('Ubuntu 24.04 LTS')
    expect(frame).toContain('qcow2')
    expect(frame).toContain('yes') // cloud-init
  })

  it('j/k navigates and Enter opens detail', async () => {
    const { stdin, lastFrame } = render(<DistrosView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()

    stdin.write('j') // Move to ubuntu
    await tick()
    stdin.write('\r') // Enter
    await tick()

    const frame = lastFrame()!
    expect(frame).toContain('Ubuntu 24.04 LTS')
  })

  it('Esc in detail returns to list', async () => {
    const { stdin, lastFrame } = render(<DistrosView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()

    stdin.write('1')
    await tick()
    expect(lastFrame()).toContain('NixOS')
    expect(lastFrame()).toContain('Format:')

    stdin.write('\x1B')
    await tick()
    expect(lastFrame()).toContain('Distro Catalog')
  })

  it('b triggers onBack from list', async () => {
    const onBack = vi.fn()
    const { stdin } = render(<DistrosView api={mockApi()} tier="weaver" onBack={onBack} />)
    await tick()

    stdin.write('b')
    await tick()

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows tier gate on 403', async () => {
    const api = mockApi({
      listDistros: vi.fn().mockResolvedValue({ status: 403, data: { error: 'Weaver Solo required' } }),
    })
    const { lastFrame } = render(<DistrosView api={api} tier="free" onBack={vi.fn()} />)
    await tick()
    expect(lastFrame()).toContain('Distro catalog')
    expect(lastFrame()).toContain('weaver')
  })

  it('shows loading state', () => {
    const api = mockApi({
      listDistros: vi.fn().mockReturnValue(new Promise(() => {})),
    })
    const { lastFrame } = render(<DistrosView api={api} tier="weaver" onBack={vi.fn()} />)
    expect(lastFrame()).toContain('Loading distro catalog')
  })
})
