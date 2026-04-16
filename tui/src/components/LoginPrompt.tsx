import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { TIERS } from '../constants/vocabularies.js'

interface LoginPromptProps {
  onLogin: (username: string, password: string) => Promise<void>
  onQuit: () => void
  initialUsername?: string
  initialPassword?: string
  tier?: string
}

const MAX_LOGIN_ATTEMPTS = 3

export function LoginPrompt({ onLogin, onQuit, initialUsername, initialPassword, tier }: LoginPromptProps) {
  const [username, setUsername] = useState(initialUsername ?? '')
  const [password, setPassword] = useState(initialPassword ?? '')
  const [field, setField] = useState<'username' | 'password'>(initialUsername ? 'password' : 'username')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)

  // Auto-submit if both provided via CLI flags
  React.useEffect(() => {
    if (initialUsername && initialPassword) {
      void handleSubmit()
    }
  }, [])

  async function handleSubmit() {
    if (!username || !password) return
    setSubmitting(true)
    setError(null)
    try {
      await onLogin(username, password)
    } catch (err) {
      const nextAttempts = attempts + 1
      setAttempts(nextAttempts)
      if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
        setError(`Login failed after ${MAX_LOGIN_ATTEMPTS} attempts`)
        setSubmitting(false)
        // Brief delay so user sees the message before exit
        setTimeout(() => onQuit(), 1500)
        return
      }
      const remaining = MAX_LOGIN_ATTEMPTS - nextAttempts
      setError(`${err instanceof Error ? err.message : 'Login failed'} (${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining)`)
      setPassword('')
      setField('password')
      setSubmitting(false)
    }
  }

  useInput((input, key) => {
    if (key.escape) {
      // Clear error and reset password — don't quit the app
      setError(null)
      setPassword('')
      setField('password')
      return
    }

    if (submitting) return

    if (key.return) {
      if (field === 'username' && username) {
        setField('password')
      } else if (field === 'password' && password) {
        void handleSubmit()
      }
      return
    }

    if (key.tab) {
      setField(f => f === 'username' ? 'password' : 'username')
      return
    }

    if (key.backspace || key.delete) {
      if (field === 'username') setUsername(u => u.slice(0, -1))
      else setPassword(p => p.slice(0, -1))
      return
    }

    if (input && !key.ctrl && !key.meta) {
      if (field === 'username') setUsername(u => u + input)
      else setPassword(p => p + input)
    }
  })

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>Login</Text>
      <Text dimColor>Press Tab to switch fields, Enter to submit, Ctrl+C to quit</Text>

      {error && <Text color="red">{error}</Text>}

      <Box marginTop={1}>
        <Text color={field === 'username' ? 'cyan' : undefined}>
          Username: {username}{field === 'username' ? '█' : ''}
        </Text>
      </Box>
      <Box>
        <Text color={field === 'password' ? 'cyan' : undefined}>
          Password: {'*'.repeat(password.length)}{field === 'password' ? '█' : ''}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {tier === TIERS.FREE || tier === TIERS.DEMO
            ? 'Forgot password? Run: sudo weaver-reset-password'
            : 'Forgot password? Contact your system administrator.'}
        </Text>
      </Box>

      {submitting && (
        <Box marginTop={1}>
          <Text color="yellow">Authenticating...</Text>
        </Box>
      )}
    </Box>
  )
}
