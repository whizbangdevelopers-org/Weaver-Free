import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import React from 'react'
import { RegisterPrompt } from '../components/RegisterPrompt.js'

const tick = () => new Promise(r => setTimeout(r, 50))

function defaultProps(overrides?: Partial<Parameters<typeof RegisterPrompt>[0]>) {
  return {
    onRegister: vi.fn().mockResolvedValue(undefined),
    onLogin: vi.fn(),
    ...overrides,
  }
}

describe('RegisterPrompt', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders first-run setup title', () => {
    const { lastFrame } = render(<RegisterPrompt {...defaultProps()} />)
    expect(lastFrame()).toContain('First-Run Setup')
  })

  it('renders all three fields', () => {
    const { lastFrame } = render(<RegisterPrompt {...defaultProps()} />)
    expect(lastFrame()).toContain('Username:')
    expect(lastFrame()).toContain('Password:')
    expect(lastFrame()).toContain('Confirm:')
  })

  it('shows cursor on username field initially', () => {
    const { lastFrame } = render(<RegisterPrompt {...defaultProps()} />)
    const frame = lastFrame()!
    // Username line should have cursor
    const lines = frame.split('\n')
    const userLine = lines.find(l => l.includes('Username:'))
    expect(userLine).toContain('█')
  })

  it('shows instructions', () => {
    const { lastFrame } = render(<RegisterPrompt {...defaultProps()} />)
    expect(lastFrame()).toContain('Tab')
    expect(lastFrame()).toContain('Enter')
    expect(lastFrame()).toContain('Esc')
  })

  it('types characters into username field', async () => {
    const { stdin, lastFrame } = render(<RegisterPrompt {...defaultProps()} />)
    await tick()

    for (const ch of 'admin') {
      stdin.write(ch)
      await tick()
    }

    expect(lastFrame()).toContain('admin')
  })

  it('Tab cycles through fields', async () => {
    const { stdin, lastFrame } = render(<RegisterPrompt {...defaultProps()} />)
    await tick()

    // Type username
    for (const ch of 'admin') {
      stdin.write(ch)
      await tick()
    }

    // Tab to password
    stdin.write('\t')
    await tick()
    await tick()

    // Type into password
    for (const ch of 'Px') {
      stdin.write(ch)
      await tick()
    }
    const frame1 = lastFrame()!
    // Should show masked password
    expect(frame1).toContain('**')

    // Tab to confirm
    stdin.write('\t')
    await tick()
    await tick()

    for (const ch of 'Qz') {
      stdin.write(ch)
      await tick()
    }
    const frame2 = lastFrame()!
    const confirmLine = frame2.split('\n').find(l => l.includes('Confirm:'))
    expect(confirmLine).toContain('**')
  })

  it('masks password with asterisks', async () => {
    const { stdin, lastFrame } = render(<RegisterPrompt {...defaultProps()} />)
    await tick()

    // Tab to password
    stdin.write('\t')
    await tick()

    for (const ch of 'Secret1x') {
      stdin.write(ch)
      await tick()
    }

    const frame = lastFrame()!
    expect(frame).toContain('********')
    expect(frame).not.toContain('Secret1x')
  })

  it('Esc navigates to login instead of quitting', async () => {
    const onLogin = vi.fn()
    const { stdin } = render(<RegisterPrompt {...defaultProps({ onLogin })} />)
    await tick()

    stdin.write('\x1B')
    await tick()

    expect(onLogin).toHaveBeenCalledOnce()
  })

  it('validates username pattern on submit', async () => {
    const onRegister = vi.fn().mockResolvedValue(undefined)
    const { stdin, lastFrame } = render(<RegisterPrompt {...defaultProps({ onRegister })} />)
    await tick()

    // Type invalid username (starts with digit)
    for (const ch of '1x') {
      stdin.write(ch)
      await tick()
    }
    // Enter to advance to password
    stdin.write('\r')
    await tick()
    // Type valid password
    for (const ch of 'Pass1234') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()
    // Type matching confirm
    for (const ch of 'Pass1234') {
      stdin.write(ch)
      await tick()
    }
    // Submit
    stdin.write('\r')
    await tick()

    // Should show username error, not call onRegister
    expect(lastFrame()).toContain('Min 3 characters')
    expect(onRegister).not.toHaveBeenCalled()
  })

  it('validates password complexity on submit', async () => {
    const onRegister = vi.fn().mockResolvedValue(undefined)
    const { stdin, lastFrame } = render(<RegisterPrompt {...defaultProps({ onRegister })} />)
    await tick()

    // Valid username
    for (const ch of 'admin') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()

    // Too-simple password (no uppercase)
    for (const ch of 'password123') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()

    // Matching confirm
    for (const ch of 'password123') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()

    expect(lastFrame()).toContain('Requires uppercase')
    expect(onRegister).not.toHaveBeenCalled()
  })

  it('validates password match on submit', async () => {
    const onRegister = vi.fn().mockResolvedValue(undefined)
    const { stdin, lastFrame } = render(<RegisterPrompt {...defaultProps({ onRegister })} />)
    await tick()

    // Valid username
    for (const ch of 'admin') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()

    // Valid password
    for (const ch of 'Pass1234') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()

    // Non-matching confirm
    for (const ch of 'Pass9999') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()

    expect(lastFrame()).toContain('do not match')
    expect(onRegister).not.toHaveBeenCalled()
  })

  it('calls onRegister with valid input', async () => {
    const onRegister = vi.fn().mockResolvedValue(undefined)
    const { stdin } = render(<RegisterPrompt {...defaultProps({ onRegister })} />)
    await tick()

    // Type valid username
    for (const ch of 'admin') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()

    // Type valid password
    for (const ch of 'Pass1234') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()

    // Type matching confirm
    for (const ch of 'Pass1234') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()
    await tick() // Extra tick for async

    expect(onRegister).toHaveBeenCalledWith('admin', 'Pass1234')
  })

  it('shows error when registration fails', async () => {
    const onRegister = vi.fn().mockRejectedValue(new Error('Username taken'))
    const { stdin, lastFrame } = render(<RegisterPrompt {...defaultProps({ onRegister })} />)
    await tick()

    for (const ch of 'admin') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()
    for (const ch of 'Pass1234') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()
    for (const ch of 'Pass1234') {
      stdin.write(ch)
      await tick()
    }
    stdin.write('\r')
    await tick()
    await tick()

    expect(lastFrame()).toContain('Username taken')
  })

  it('backspace removes last character from active field', async () => {
    const { stdin, lastFrame } = render(<RegisterPrompt {...defaultProps()} />)
    await tick()

    for (const ch of 'admn') {
      stdin.write(ch)
      await tick()
    }
    // Backspace
    stdin.write('\x7F')
    await tick()

    expect(lastFrame()).toContain('adm')
    expect(lastFrame()).not.toContain('admn')
  })
})
