import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TuiApiClient } from '../../client/api.js'
import type { SafeUser } from '../../types/user.js'
import { ROLES } from '../../constants/vocabularies.js'
import { TierGateMessage } from '../TierGateMessage.js'
import { FeatureUnavailable } from '../FeatureUnavailable.js'

interface UsersViewProps {
  api: TuiApiClient
  tier: string
  onBack: () => void
  onSelectUser: (userId: string) => void
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

const ROLE_COLORS: Record<string, string> = {
  [ROLES.ADMIN]: 'red',
  [ROLES.OPERATOR]: 'yellow',
  [ROLES.VIEWER]: 'gray',
}

export function UsersView({ api, tier, onBack, onSelectUser }: UsersViewProps) {
  const [users, setUsers] = useState<SafeUser[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    void api.listUsers().then(result => {
      if (result.status === 200) {
        setUsers(result.data as SafeUser[])
      } else if (result.status === 403) {
        setBlocked(true)
      } else {
        setUnavailable(true)
      }
      setLoading(false)
    })
  }, [api])

  useInput((input, key) => {
    if (key.escape || input === 'b') {
      onBack()
      return
    }

    if (!users || users.length === 0) return

    if (key.upArrow || input === 'k') {
      setSelectedIndex(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex(i => Math.min(users.length - 1, i + 1))
      return
    }
    if (key.return || input === 'd') {
      const user = users[selectedIndex]
      if (user) onSelectUser(user.id)
    }
  })

  if (blocked) {
    return <TierGateMessage feature="User management" requiredTier="fabrick" currentTier={tier} onBack={onBack} />
  }

  if (unavailable) {
    return <FeatureUnavailable feature="User Management" onBack={onBack} />
  }

  if (loading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color="yellow">Loading users...</Text>
      </Box>
    )
  }

  if (!users) return null

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>User Management</Text>

      <Box marginTop={1}>
        <Text bold dimColor>
          {'  '}{pad('USERNAME', 20)}{pad('ROLE', 14)}{pad('CREATED', 14)}{pad('ID', 12)}
        </Text>
      </Box>

      {users.map((user, i) => {
        const selected = i === selectedIndex
        return (
          <Box key={user.id}>
            <Text color={selected ? 'cyan' : undefined} bold={selected}>
              {selected ? '> ' : '  '}{pad(user.username, 20)}
            </Text>
            <Text color={ROLE_COLORS[user.role] ?? 'white'}>
              {pad(user.role, 14)}
            </Text>
            <Text dimColor>{pad(user.createdAt.slice(0, 10), 14)}</Text>
            <Text dimColor>{pad(user.id, 12)}</Text>
          </Box>
        )
      })}

      <Box marginTop={1}>
        <Text dimColor>[j/k] navigate [Enter] detail [b]ack</Text>
      </Box>
    </Box>
  )
}
