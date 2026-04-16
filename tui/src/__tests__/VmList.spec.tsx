import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import React from 'react'
import { VmList } from '../components/VmList.js'
import type { VmInfo } from '../types/vm.js'

// Allow React effects to fire (useInput registers stdin listener via useEffect)
const tick = () => new Promise(r => setTimeout(r, 50))

const mockVms: VmInfo[] = [
  {
    name: 'web-nginx',
    status: 'running',
    ip: '10.10.0.10',
    mem: 256,
    vcpu: 1,
    hypervisor: 'qemu',
    uptime: new Date(Date.now() - 3_600_000).toISOString(),
    distro: 'nixos',
  },
  {
    name: 'ci-runner',
    status: 'idle',
    ip: '10.10.0.40',
    mem: 512,
    vcpu: 1,
    hypervisor: 'firecracker',
    uptime: null,
    distro: 'nixos',
  },
  {
    name: 'staging-env',
    status: 'failed',
    ip: '10.10.0.50',
    mem: 1024,
    vcpu: 2,
    hypervisor: 'qemu',
    uptime: null,
    distro: 'alma-9',
  },
]

function defaultProps(overrides?: Partial<Parameters<typeof VmList>[0]>) {
  return {
    vms: mockVms,
    onAction: vi.fn().mockResolvedValue(undefined),
    onSelect: vi.fn(),
    onAgent: vi.fn(),
    onQuit: vi.fn(),
    onLogout: vi.fn(),
    ...overrides,
  }
}

describe('VmList', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders VM names in sorted order', () => {
    const { lastFrame } = render(<VmList {...defaultProps()} />)
    const frame = lastFrame()!
    // VMs should be sorted alphabetically: ci-runner, staging-env, web-nginx
    const ciPos = frame.indexOf('ci-runner')
    const stagingPos = frame.indexOf('staging-env')
    const nginxPos = frame.indexOf('web-nginx')
    expect(ciPos).toBeGreaterThan(-1)
    expect(stagingPos).toBeGreaterThan(ciPos)
    expect(nginxPos).toBeGreaterThan(stagingPos)
  })

  it('renders header row with column names', () => {
    const { lastFrame } = render(<VmList {...defaultProps()} />)
    const frame = lastFrame()!
    expect(frame).toContain('NAME')
    expect(frame).toContain('STATUS')
    expect(frame).toContain('IP')
    expect(frame).toContain('MEM')
  })

  it('shows selection cursor on first item', () => {
    const { lastFrame } = render(<VmList {...defaultProps()} />)
    const frame = lastFrame()!
    // First VM alphabetically is ci-runner, should have > prefix
    expect(frame).toContain('> ci-runner')
  })

  it('shows key legend', () => {
    const { lastFrame } = render(<VmList {...defaultProps()} />)
    const frame = lastFrame()!
    expect(frame).toContain('[s]tart')
    expect(frame).toContain('[S]top')
    expect(frame).toContain('[r]estart')
    expect(frame).toContain('[d]etail')
    expect(frame).toContain('[a]gent')
    expect(frame).toContain('[q]uit')
  })

  it('shows empty state when no VMs', () => {
    const { lastFrame } = render(<VmList {...defaultProps({ vms: [] })} />)
    expect(lastFrame()).toContain('No VMs found')
  })

  it('keyboard j moves selection down', async () => {
    const { stdin, lastFrame } = render(<VmList {...defaultProps()} />)
    expect(lastFrame()).toContain('> ci-runner')

    await tick() // Let useInput effect register stdin listener
    stdin.write('j')
    await tick()

    expect(lastFrame()).toContain('> staging-env')
  })

  it('keyboard k moves selection up after j', async () => {
    const { stdin, lastFrame } = render(<VmList {...defaultProps()} />)
    await tick()

    stdin.write('j')
    await tick()
    stdin.write('k')
    await tick()

    expect(lastFrame()).toContain('> ci-runner')
  })

  it('q triggers onQuit', async () => {
    const onQuit = vi.fn()
    const { stdin } = render(<VmList {...defaultProps({ onQuit })} />)
    await tick()

    stdin.write('q')
    await tick()

    expect(onQuit).toHaveBeenCalledOnce()
  })

  it('d triggers onSelect with current VM name', async () => {
    const onSelect = vi.fn()
    const { stdin } = render(<VmList {...defaultProps({ onSelect })} />)
    await tick()

    stdin.write('d')
    await tick()

    expect(onSelect).toHaveBeenCalledWith('ci-runner')
  })

  it('a triggers onAgent with current VM name', async () => {
    const onAgent = vi.fn()
    const { stdin } = render(<VmList {...defaultProps({ onAgent })} />)
    await tick()

    stdin.write('a')
    await tick()

    expect(onAgent).toHaveBeenCalledWith('ci-runner')
  })

  it('s on stopped VM triggers start action', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined)
    const { stdin } = render(<VmList {...defaultProps({ onAction })} />)
    await tick()

    // ci-runner is first (idle)
    stdin.write('s')
    await tick()

    expect(onAction).toHaveBeenCalledWith('ci-runner', 'start')
  })

  it('S on running VM triggers stop action', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined)
    const { stdin } = render(<VmList {...defaultProps({ onAction })} />)
    await tick()

    // Navigate to web-nginx (index 2, running)
    stdin.write('j')
    await tick()
    stdin.write('j')
    await tick()

    stdin.write('S')
    await tick()

    expect(onAction).toHaveBeenCalledWith('web-nginx', 'stop')
  })

  it('L triggers onLogout', async () => {
    const onLogout = vi.fn()
    const { stdin } = render(<VmList {...defaultProps({ onLogout })} />)
    await tick()

    stdin.write('L')
    await tick()

    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('shows VM IP addresses', () => {
    const { lastFrame } = render(<VmList {...defaultProps()} />)
    expect(lastFrame()).toContain('10.10.0.10')
    expect(lastFrame()).toContain('10.10.0.40')
  })

  it('shows formatted memory', () => {
    const { lastFrame } = render(<VmList {...defaultProps()} />)
    expect(lastFrame()).toContain('256MB')
    expect(lastFrame()).toContain('512MB')
    expect(lastFrame()).toContain('1.0GB')
  })

  // --- Search ---

  it('/ enters search mode and typing filters VMs', async () => {
    const { stdin, lastFrame } = render(<VmList {...defaultProps()} />)
    await tick()

    stdin.write('/')
    await tick()

    // Should show search prompt
    expect(lastFrame()).toContain('Search:')

    for (const ch of 'web') {
      stdin.write(ch)
      await tick()
    }

    const frame = lastFrame()!
    // web-nginx should be visible, others hidden
    expect(frame).toContain('web-nginx')
    expect(frame).not.toContain('ci-runner')
    expect(frame).not.toContain('staging-env')
  })

  it('Esc in search mode clears query', async () => {
    const { stdin, lastFrame } = render(<VmList {...defaultProps()} />)
    await tick()

    stdin.write('/')
    await tick()
    stdin.write('x')
    await tick()

    // Esc should clear
    stdin.write('\x1B')
    await tick()

    // All VMs should be visible again
    const frame = lastFrame()!
    expect(frame).toContain('ci-runner')
    expect(frame).toContain('web-nginx')
  })

  it('Enter in search mode keeps query and exits search', async () => {
    const { stdin, lastFrame } = render(<VmList {...defaultProps()} />)
    await tick()

    stdin.write('/')
    await tick()
    for (const ch of 'ci') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()

    // Query should still be active (filtering) but no longer in search mode
    const frame = lastFrame()!
    expect(frame).toContain('ci-runner')
    expect(frame).not.toContain('web-nginx')
    // Search bar still shows (with query)
    expect(frame).toContain('Search: ci')
  })

  // --- Status filter ---

  it('t cycles status filter', async () => {
    const { stdin, lastFrame } = render(<VmList {...defaultProps()} />)
    await tick()

    // First t: running
    stdin.write('t')
    await tick()

    let frame = lastFrame()!
    expect(frame).toContain('web-nginx')
    expect(frame).not.toContain('ci-runner')
    expect(frame).toContain('Filter: running')

    // Second t: idle
    stdin.write('t')
    await tick()

    frame = lastFrame()!
    expect(frame).toContain('ci-runner')
    expect(frame).not.toContain('web-nginx')
    expect(frame).toContain('Filter: idle')

    // Third t: stopped
    stdin.write('t')
    await tick()

    frame = lastFrame()!
    expect(frame).not.toContain('ci-runner')
    expect(frame).not.toContain('web-nginx')
    expect(frame).toContain('Filter: stopped')

    // Fourth t: failed
    stdin.write('t')
    await tick()

    frame = lastFrame()!
    expect(frame).toContain('staging-env')
    expect(frame).not.toContain('ci-runner')

    // Fifth t: back to all
    stdin.write('t')
    await tick()

    frame = lastFrame()!
    expect(frame).toContain('ci-runner')
    expect(frame).toContain('web-nginx')
    expect(frame).toContain('staging-env')
  })

  // --- Scan ---

  it('f triggers onScan', async () => {
    const onScan = vi.fn().mockResolvedValue({ status: 200, data: { discovered: ['new-vm'], added: ['new-vm'] } })
    const { stdin } = render(<VmList {...defaultProps({ onScan })} />)
    await tick()

    stdin.write('f')
    await tick()

    expect(onScan).toHaveBeenCalledOnce()
  })

  // --- Help ---

  it('? triggers onHelp', async () => {
    const onHelp = vi.fn()
    const { stdin } = render(<VmList {...defaultProps({ onHelp })} />)
    await tick()

    stdin.write('?')
    await tick()

    expect(onHelp).toHaveBeenCalledOnce()
  })

  // --- Create ---

  it('n triggers onCreateVm', async () => {
    const onCreateVm = vi.fn()
    const { stdin } = render(<VmList {...defaultProps({ onCreateVm })} />)
    await tick()

    stdin.write('n')
    await tick()

    expect(onCreateVm).toHaveBeenCalledOnce()
  })

  // --- Weaver Solo keybindings ---

  it('D triggers onDistros', async () => {
    const onDistros = vi.fn()
    const { stdin } = render(<VmList {...defaultProps({ onDistros })} />)
    await tick()

    stdin.write('D')
    await tick()

    expect(onDistros).toHaveBeenCalledOnce()
  })

  it('T triggers onTemplates', async () => {
    const onTemplates = vi.fn()
    const { stdin } = render(<VmList {...defaultProps({ onTemplates })} />)
    await tick()

    stdin.write('T')
    await tick()

    expect(onTemplates).toHaveBeenCalledOnce()
  })

  it('shows Distros and Templates in key legend when callbacks provided', () => {
    const { lastFrame } = render(<VmList {...defaultProps({ onDistros: vi.fn(), onTemplates: vi.fn(), onNetwork: vi.fn() })} />)
    const frame = lastFrame()!
    expect(frame).toContain('[D]istros')
    expect(frame).toContain('[T]emplates')
  })
})
