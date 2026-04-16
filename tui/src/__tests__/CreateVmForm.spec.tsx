import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import React from 'react'
import { CreateVmForm } from '../components/CreateVmForm.js'

const tick = () => new Promise(r => setTimeout(r, 50))

function defaultProps(overrides?: Partial<Parameters<typeof CreateVmForm>[0]>) {
  return {
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onBack: vi.fn(),
    ...overrides,
  }
}

describe('CreateVmForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders create VM title', () => {
    const { lastFrame } = render(<CreateVmForm {...defaultProps()} />)
    expect(lastFrame()).toContain('Create VM')
  })

  it('renders all five fields', () => {
    const { lastFrame } = render(<CreateVmForm {...defaultProps()} />)
    expect(lastFrame()).toContain('Name:')
    expect(lastFrame()).toContain('IP:')
    expect(lastFrame()).toContain('Memory (MB):')
    expect(lastFrame()).toContain('vCPUs:')
    expect(lastFrame()).toContain('Hypervisor:')
  })

  it('shows default values for mem and vcpu', () => {
    const { lastFrame } = render(<CreateVmForm {...defaultProps()} />)
    expect(lastFrame()).toContain('256')
    expect(lastFrame()).toContain('vCPUs:')
  })

  it('shows cursor on name field initially', () => {
    const { lastFrame } = render(<CreateVmForm {...defaultProps()} />)
    const lines = lastFrame()!.split('\n')
    const nameLine = lines.find(l => l.includes('Name:'))
    expect(nameLine).toContain('█')
  })

  it('types characters into name field', async () => {
    const { stdin, lastFrame } = render(<CreateVmForm {...defaultProps()} />)
    await tick()

    for (const ch of 'web-1') {
      stdin.write(ch)
      await tick()
    }

    expect(lastFrame()).toContain('web-1')
  })

  it('Esc triggers onBack', async () => {
    const onBack = vi.fn()
    const { stdin } = render(<CreateVmForm {...defaultProps({ onBack })} />)
    await tick()

    stdin.write('\x1B')
    await tick()

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('only accepts digits for mem field', async () => {
    const { stdin, lastFrame } = render(<CreateVmForm {...defaultProps()} />)
    await tick()

    // Tab to mem field (skip name and ip)
    stdin.write('\t')
    await tick()
    stdin.write('\t')
    await tick()
    await tick()

    // Try typing letters (should be ignored)
    stdin.write('a')
    await tick()
    stdin.write('b')
    await tick()
    // Type digit
    stdin.write('5')
    await tick()

    const frame = lastFrame()!
    const memLine = frame.split('\n').find(l => l.includes('Memory'))
    expect(memLine).toContain('2565')
    expect(memLine).not.toContain('a')
  })

  it('cycles hypervisor with arrow keys', async () => {
    const { stdin, lastFrame } = render(<CreateVmForm {...defaultProps()} />)
    await tick()

    // Tab to hypervisor (4 tabs)
    for (let i = 0; i < 4; i++) {
      stdin.write('\t')
      await tick()
    }
    await tick()

    // Default is qemu
    expect(lastFrame()).toContain('qemu')

    // Right arrow to next
    stdin.write('\x1B[C') // right arrow
    await tick()

    expect(lastFrame()).toContain('cloud-hypervisor')

    // Right arrow again
    stdin.write('\x1B[C')
    await tick()

    expect(lastFrame()).toContain('crosvm')
  })

  it('validates name pattern on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { stdin, lastFrame } = render(<CreateVmForm {...defaultProps({ onSubmit })} />)
    await tick()

    // Short name
    stdin.write('x')
    await tick()
    // Enter to advance to IP
    stdin.write('\r')
    await tick()
    // Type IP
    for (const ch of '10.0.0.1') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()
    // Skip mem (use default 256)
    stdin.write('\r')
    await tick()
    // Skip vcpu (use default 1)
    stdin.write('\r')
    await tick()
    // Submit on hypervisor
    stdin.write('\r')
    await tick()

    expect(lastFrame()).toContain('Min 2 characters')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('validates IP format on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { stdin, lastFrame } = render(<CreateVmForm {...defaultProps({ onSubmit })} />)
    await tick()

    // Valid name
    for (const ch of 'web-1') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()

    // Bad IP
    for (const ch of 'not-an-ip') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()
    // Skip mem/vcpu defaults
    stdin.write('\r')
    await tick()
    stdin.write('\r')
    await tick()
    // Submit
    stdin.write('\r')
    await tick()

    expect(lastFrame()).toContain('valid IPv4')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with valid input', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { stdin } = render(<CreateVmForm {...defaultProps({ onSubmit })} />)
    await tick()

    // Name
    for (const ch of 'web-1') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()

    // IP
    for (const ch of '10.10.0.50') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()

    // Mem (use default 256)
    stdin.write('\r')
    await tick()

    // vCPU (use default 1)
    stdin.write('\r')
    await tick()

    // Submit on hypervisor (default qemu)
    stdin.write('\r')
    await tick()
    await tick()

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'web-1',
      ip: '10.10.0.50',
      mem: 256,
      vcpu: 1,
      hypervisor: 'qemu',
    })
  })

  it('shows error when creation fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('VM already exists'))
    const { stdin, lastFrame } = render(<CreateVmForm {...defaultProps({ onSubmit })} />)
    await tick()

    for (const ch of 'web-1') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()
    for (const ch of '10.10.0.50') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()
    stdin.write('\r')
    await tick()
    stdin.write('\r')
    await tick()
    stdin.write('\r')
    await tick()
    await tick()

    expect(lastFrame()).toContain('VM already exists')
  })

  it('backspace removes last character', async () => {
    const { stdin, lastFrame } = render(<CreateVmForm {...defaultProps()} />)
    await tick()

    for (const ch of 'webx') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\x7F')
    await tick()

    expect(lastFrame()).toContain('web')
    expect(lastFrame()).not.toContain('webx')
  })
})
