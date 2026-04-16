import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import React from 'react'
import { LoginPrompt } from '../components/LoginPrompt.js'

// Allow React effects to fire (useInput registers stdin listener via useEffect)
const tick = () => new Promise(r => setTimeout(r, 50))

function defaultProps(overrides?: Partial<Parameters<typeof LoginPrompt>[0]>) {
  return {
    onLogin: vi.fn().mockResolvedValue(undefined),
    onQuit: vi.fn(),
    ...overrides,
  }
}

/** Helper: type a string character-by-character into stdin */
async function typeString(stdin: { write: (s: string) => void }, text: string) {
  for (const ch of text) {
    stdin.write(ch)
    await tick()
  }
}

/** Helper: fill username + password and submit */
async function fillAndSubmit(
  stdin: { write: (s: string) => void },
  username: string,
  password: string,
) {
  await typeString(stdin, username)
  stdin.write('\r') // Enter → password field
  await tick()
  await typeString(stdin, password)
  stdin.write('\r') // Enter → submit
  await tick()
  await tick() // async propagation
}

describe('LoginPrompt', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('renders login title', () => {
    const { lastFrame } = render(<LoginPrompt {...defaultProps()} />)
    expect(lastFrame()).toContain('Login')
  })

  it('renders username and password fields', () => {
    const { lastFrame } = render(<LoginPrompt {...defaultProps()} />)
    expect(lastFrame()).toContain('Username:')
    expect(lastFrame()).toContain('Password:')
  })

  it('shows cursor on username field initially', () => {
    const { lastFrame } = render(<LoginPrompt {...defaultProps()} />)
    const frame = lastFrame()!
    expect(frame).toContain('Username:')
    expect(frame).toContain('█')
  })

  it('shows instructions', () => {
    const { lastFrame } = render(<LoginPrompt {...defaultProps()} />)
    expect(lastFrame()).toContain('Tab')
    expect(lastFrame()).toContain('Enter')
    expect(lastFrame()).toContain('Ctrl+C')
  })

  it('types characters into username field', async () => {
    const { stdin, lastFrame } = render(<LoginPrompt {...defaultProps()} />)
    await tick()

    await typeString(stdin, 'admin')

    expect(lastFrame()).toContain('admin')
  })

  it('masks password with asterisks', async () => {
    const { stdin, lastFrame } = render(<LoginPrompt {...defaultProps()} />)
    await tick()

    // Type username
    stdin.write('u')
    await tick()
    // Tab to password field
    stdin.write('\t')
    await tick()
    // Type password characters
    await typeString(stdin, 'secret')

    const frame = lastFrame()!
    expect(frame).toContain('******')
    expect(frame).not.toContain('secret')
  })

  it('Esc clears error and resets password instead of quitting', async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
    const onQuit = vi.fn()
    const { stdin, lastFrame } = render(<LoginPrompt {...defaultProps({ onLogin, onQuit })} />)
    await tick()

    // Trigger an error first
    await fillAndSubmit(stdin, 'admin', 'wrong')
    expect(lastFrame()).toContain('Invalid credentials')

    // Press Esc — should clear error, NOT quit
    stdin.write('\x1B')
    await tick()

    expect(onQuit).not.toHaveBeenCalled()
    expect(lastFrame()).not.toContain('Invalid credentials')
  })

  it('shows error message and remaining attempts on failure', async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
    const { stdin, lastFrame } = render(<LoginPrompt {...defaultProps({ onLogin })} />)
    await tick()

    await fillAndSubmit(stdin, 'admin', 'wrong')

    const frame = lastFrame()!
    expect(frame).toContain('Invalid credentials')
    expect(frame).toContain('2 attempts remaining')
  })

  it('clears password and refocuses password field after failure', async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
    const { stdin, lastFrame } = render(<LoginPrompt {...defaultProps({ onLogin })} />)
    await tick()

    await fillAndSubmit(stdin, 'admin', 'wrong')

    const frame = lastFrame()!
    // Password field should be empty (cleared) and active (has cursor)
    expect(frame).toMatch(/Password:\s*█/)
    // Username should still be there
    expect(frame).toContain('admin')
  })

  it('allows retry after failed attempt', async () => {
    const onLogin = vi.fn()
      .mockRejectedValueOnce(new Error('Invalid credentials'))
      .mockResolvedValueOnce(undefined)
    const { stdin, lastFrame } = render(<LoginPrompt {...defaultProps({ onLogin })} />)
    await tick()

    // First attempt — fails
    await fillAndSubmit(stdin, 'admin', 'wrong')
    expect(lastFrame()).toContain('Invalid credentials')

    // Second attempt — type new password and submit
    await typeString(stdin, 'correct')
    stdin.write('\r')
    await tick()
    await tick()

    expect(onLogin).toHaveBeenCalledTimes(2)
    expect(onLogin).toHaveBeenLastCalledWith('admin', 'correct')
  })

  it('exits after 3 failed attempts', async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
    const onQuit = vi.fn()
    const { stdin, lastFrame } = render(<LoginPrompt {...defaultProps({ onLogin, onQuit })} />)
    await tick()

    // Attempt 1
    await fillAndSubmit(stdin, 'admin', 'wrong1')
    expect(lastFrame()).toContain('2 attempts remaining')

    // Attempt 2
    await typeString(stdin, 'wrong2')
    stdin.write('\r')
    await tick()
    await tick()
    expect(lastFrame()).toContain('1 attempt remaining')

    // Attempt 3 — should trigger exit
    await typeString(stdin, 'wrong3')
    stdin.write('\r')
    await tick()
    await tick()
    expect(lastFrame()).toContain('Login failed after 3 attempts')

    // Advance past the 1500ms exit delay
    vi.advanceTimersByTime(1600)
    await tick()

    expect(onQuit).toHaveBeenCalledOnce()
  })

  it('pre-fills username when initialUsername is provided', () => {
    const { lastFrame } = render(
      <LoginPrompt {...defaultProps({ initialUsername: 'admin' })} />
    )
    expect(lastFrame()).toContain('admin')
  })
})
