import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import React from 'react'
import { TemplatesView } from '../components/weaver/TemplatesView.js'

const tick = () => new Promise(r => setTimeout(r, 50))

const mockTemplates = [
  { id: 't1', name: 'Web Server', description: 'Nginx reverse proxy', distro: 'nixos',
    mem: 256, vcpu: 1, hypervisor: 'qemu', autostart: true, tags: ['web'], category: 'builtin' },
  { id: 't2', name: 'App Server', description: 'Node.js runtime', distro: 'nixos',
    mem: 512, vcpu: 2, hypervisor: 'qemu', autostart: true, tags: ['app'], category: 'builtin' },
  { id: 't3', name: 'Database', description: 'PostgreSQL with 1GB RAM', distro: 'nixos',
    mem: 1024, vcpu: 2, hypervisor: 'qemu', autostart: true, tags: ['db'], category: 'custom' },
]

function mockApi(overrides?: Partial<{ listTemplates: () => Promise<unknown> }>) {
  return {
    listTemplates: vi.fn().mockResolvedValue({ status: 200, data: mockTemplates }),
    ...overrides,
  } as unknown as Parameters<typeof TemplatesView>[0]['api']
}

describe('TemplatesView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders title', async () => {
    const { lastFrame } = render(<TemplatesView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()
    expect(lastFrame()).toContain('VM Templates')
  })

  it('renders template names', async () => {
    const { lastFrame } = render(<TemplatesView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()
    const frame = lastFrame()!
    expect(frame).toContain('Web Server')
    expect(frame).toContain('App Server')
    expect(frame).toContain('Database')
  })

  it('renders column headers', async () => {
    const { lastFrame } = render(<TemplatesView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()
    const frame = lastFrame()!
    expect(frame).toContain('NAME')
    expect(frame).toContain('DISTRO')
    expect(frame).toContain('MEM')
    expect(frame).toContain('HYPERVISOR')
  })

  it('shows number keys in legend', async () => {
    const { lastFrame } = render(<TemplatesView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()
    expect(lastFrame()).toContain('[1-3] select')
  })

  it('number key selects template detail', async () => {
    const { stdin, lastFrame } = render(<TemplatesView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()

    stdin.write('2')
    await tick()

    const frame = lastFrame()!
    expect(frame).toContain('App Server')
    expect(frame).toContain('Node.js runtime')
    expect(frame).toContain('512MB')
  })

  it('j/k navigates and Enter opens detail', async () => {
    const { stdin, lastFrame } = render(<TemplatesView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()

    stdin.write('j') // Move to App Server
    await tick()
    stdin.write('\r') // Enter
    await tick()

    const frame = lastFrame()!
    expect(frame).toContain('App Server')
    expect(frame).toContain('Node.js runtime')
  })

  it('Esc in detail returns to list', async () => {
    const { stdin, lastFrame } = render(<TemplatesView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()

    stdin.write('1') // Select first
    await tick()
    expect(lastFrame()).toContain('Nginx reverse proxy')

    stdin.write('\x1B') // Esc
    await tick()
    expect(lastFrame()).toContain('VM Templates')
  })

  it('b triggers onBack from list', async () => {
    const onBack = vi.fn()
    const { stdin } = render(<TemplatesView api={mockApi()} tier="weaver" onBack={onBack} />)
    await tick()

    stdin.write('b')
    await tick()

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows tier gate on 403', async () => {
    const api = mockApi({
      listTemplates: vi.fn().mockResolvedValue({ status: 403, data: { error: 'Weaver Solo required' } }),
    })
    const { lastFrame } = render(<TemplatesView api={api} tier="free" onBack={vi.fn()} />)
    await tick()
    expect(lastFrame()).toContain('VM templates')
    expect(lastFrame()).toContain('weaver')
  })

  it('shows loading state', () => {
    const api = mockApi({
      listTemplates: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    })
    const { lastFrame } = render(<TemplatesView api={api} tier="weaver" onBack={vi.fn()} />)
    expect(lastFrame()).toContain('Loading templates')
  })

  it('shows formatted memory in detail', async () => {
    const { stdin, lastFrame } = render(<TemplatesView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()

    stdin.write('3') // Database (1024MB = 1.0GB)
    await tick()

    expect(lastFrame()).toContain('1.0GB')
  })

  it('shows tags in detail', async () => {
    const { stdin, lastFrame } = render(<TemplatesView api={mockApi()} tier="weaver" onBack={vi.fn()} />)
    await tick()

    stdin.write('1') // Web Server has tags: ['web']
    await tick()

    expect(lastFrame()).toContain('web')
  })
})
