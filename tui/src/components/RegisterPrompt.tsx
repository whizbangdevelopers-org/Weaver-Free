import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

interface RegisterPromptProps {
  onRegister: (username: string, password: string) => Promise<void>
  onLogin: () => void
}

type Field = 'username' | 'password' | 'confirm'

const USERNAME_RE = /^[a-z][a-z0-9_-]*$/
const MIN_USERNAME = 3
const MIN_PASSWORD = 8

function validateUsername(v: string): string | null {
  if (v.length < MIN_USERNAME) return `Min ${MIN_USERNAME} characters`
  if (!USERNAME_RE.test(v)) return 'Lowercase, digits, hyphens, underscores only (start with letter)'
  return null
}

function validatePassword(v: string): string | null {
  if (v.length < MIN_PASSWORD) return `Min ${MIN_PASSWORD} characters`
  if (!/[a-z]/.test(v)) return 'Requires lowercase letter'
  if (!/[A-Z]/.test(v)) return 'Requires uppercase letter'
  if (!/[0-9]/.test(v)) return 'Requires digit'
  return null
}

function validateConfirm(password: string, confirm: string): string | null {
  if (confirm !== password) return 'Passwords do not match'
  return null
}

export function RegisterPrompt({ onRegister, onLogin }: RegisterPromptProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [field, setField] = useState<Field>('username')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Set<Field>>(new Set())

  async function handleSubmit() {
    // Validate all fields
    const uErr = validateUsername(username)
    if (uErr) { setError(uErr); setField('username'); return }
    const pErr = validatePassword(password)
    if (pErr) { setError(pErr); setField('password'); return }
    const cErr = validateConfirm(password, confirm)
    if (cErr) { setError(cErr); setField('confirm'); return }

    setSubmitting(true)
    setError(null)
    try {
      await onRegister(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      setPassword('')
      setConfirm('')
      setField('password')
      setSubmitting(false)
    }
  }

  const FIELDS: Field[] = ['username', 'password', 'confirm']

  function nextField() {
    const idx = FIELDS.indexOf(field)
    if (idx < FIELDS.length - 1) {
      setTouched(t => new Set(t).add(field))
      setField(FIELDS[idx + 1]!)
    }
  }

  function prevField() {
    const idx = FIELDS.indexOf(field)
    if (idx > 0) {
      setField(FIELDS[idx - 1]!)
    }
  }

  useInput((input, key) => {
    if (key.escape) {
      onLogin()
      return
    }

    if (submitting) return

    if (key.return) {
      if (field === 'confirm' && confirm) {
        void handleSubmit()
      } else {
        const current = field === 'username' ? username : field === 'password' ? password : confirm
        if (current) nextField()
      }
      return
    }

    if (key.tab) {
      if (key.shift) {
        prevField()
      } else {
        setTouched(t => new Set(t).add(field))
        const idx = FIELDS.indexOf(field)
        setField(FIELDS[(idx + 1) % FIELDS.length]!)
      }
      return
    }

    if (key.backspace || key.delete) {
      if (field === 'username') setUsername(u => u.slice(0, -1))
      else if (field === 'password') setPassword(p => p.slice(0, -1))
      else setConfirm(c => c.slice(0, -1))
      return
    }

    if (input && !key.ctrl && !key.meta) {
      if (field === 'username') setUsername(u => u + input)
      else if (field === 'password') setPassword(p => p + input)
      else setConfirm(c => c + input)
    }
  })

  // Inline validation hints (show only after leaving field)
  const uHint = touched.has('username') && username ? validateUsername(username) : null
  const pHint = touched.has('password') && password ? validatePassword(password) : null
  const cHint = touched.has('confirm') && confirm ? validateConfirm(password, confirm) : null

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>First-Run Setup</Text>
      <Text dimColor>Create an admin account. Tab to switch fields, Enter to advance</Text>
      <Text dimColor>Already have an account? Press Esc or Ctrl+L to go to login</Text>

      {error && <Text color="red">{error}</Text>}

      <Box marginTop={1}>
        <Text color={field === 'username' ? 'cyan' : undefined}>
          Username: {username}{field === 'username' ? '█' : ''}
        </Text>
        {uHint && <Text color="yellow"> {uHint}</Text>}
      </Box>
      <Box>
        <Text color={field === 'password' ? 'cyan' : undefined}>
          Password: {'*'.repeat(password.length)}{field === 'password' ? '█' : ''}
        </Text>
        {pHint && <Text color="yellow"> {pHint}</Text>}
      </Box>
      <Box>
        <Text color={field === 'confirm' ? 'cyan' : undefined}>
          Confirm:  {'*'.repeat(confirm.length)}{field === 'confirm' ? '█' : ''}
        </Text>
        {cHint && <Text color="yellow"> {cHint}</Text>}
      </Box>

      {submitting && (
        <Box marginTop={1}>
          <Text color="yellow">Creating account...</Text>
        </Box>
      )}
    </Box>
  )
}
