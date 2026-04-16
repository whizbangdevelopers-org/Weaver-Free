import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import React from 'react'
import { HelpView } from '../components/HelpView.js'

const tick = () => new Promise(r => setTimeout(r, 50))

function defaultProps(overrides?: Partial<Parameters<typeof HelpView>[0]>) {
  return {
    tier: 'weaver',
    onBack: vi.fn(),
    ...overrides,
  }
}

describe('HelpView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders help heading', () => {
    const { lastFrame } = render(<HelpView {...defaultProps()} />)
    expect(lastFrame()).toContain('Help')
  })

  it('shows current tier', () => {
    const { lastFrame } = render(<HelpView {...defaultProps({ tier: 'fabrick' })} />)
    expect(lastFrame()).toContain('fabrick')
  })

  it('shows navigation keybindings', () => {
    const { lastFrame } = render(<HelpView {...defaultProps()} />)
    const frame = lastFrame()!
    expect(frame).toContain('j / k')
    expect(frame).toContain('Move selection')
  })

  it('shows VM action keybindings', () => {
    const { lastFrame } = render(<HelpView {...defaultProps()} />)
    const frame = lastFrame()!
    expect(frame).toContain('Start stopped VM')
    expect(frame).toContain('Stop running VM')
    expect(frame).toContain('Create new VM')
  })

  it('shows tier feature matrix', () => {
    const { lastFrame } = render(<HelpView {...defaultProps()} />)
    const frame = lastFrame()!
    expect(frame).toContain('VM management')
    expect(frame).toContain('User management')
    expect(frame).toContain('Audit log')
  })

  it('Esc triggers onBack', async () => {
    const onBack = vi.fn()
    const { stdin } = render(<HelpView {...defaultProps({ onBack })} />)
    await tick()

    stdin.write('\x1B')
    await tick()

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('q triggers onBack', async () => {
    const onBack = vi.fn()
    const { stdin } = render(<HelpView {...defaultProps({ onBack })} />)
    await tick()

    stdin.write('q')
    await tick()

    expect(onBack).toHaveBeenCalledOnce()
  })
})
