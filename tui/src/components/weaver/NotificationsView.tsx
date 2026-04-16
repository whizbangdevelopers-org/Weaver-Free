import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TuiApiClient } from '../../client/api.js'
import type { Notification } from '../../types/notification.js'
import { TierGateMessage } from '../TierGateMessage.js'

interface NotificationsViewProps {
  api: TuiApiClient
  tier: string
  onBack: () => void
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

const SEVERITY_COLORS: Record<string, string> = {
  success: 'green',
  info: 'cyan',
  warning: 'yellow',
  error: 'red',
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function NotificationsView({ api, tier, onBack }: NotificationsViewProps) {
  const [data, setData] = useState<Notification[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    void api.getNotifications().then(result => {
      if (result.status === 403) {
        setBlocked(true)
      } else if (result.status === 200) {
        const r = result.data as { notifications: Notification[] }
        setData(r.notifications)
      }
      setLoading(false)
    })
  }, [api])

  useInput((input, key) => {
    if (key.escape || input === 'b') onBack()
  })

  if (blocked) {
    return <TierGateMessage feature="Notifications" requiredTier="weaver" currentTier={tier} onBack={onBack} />
  }

  if (loading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color="yellow">Loading notifications...</Text>
      </Box>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold>Notifications</Text>
        <Text dimColor>No notifications</Text>
        <Box marginTop={1}><Text dimColor>[b]ack</Text></Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>Notifications</Text>

      <Box marginTop={1}>
        <Text bold dimColor>
          {pad('TIME', 8)}{pad('SEVERITY', 10)}{pad('EVENT', 14)}{pad('VM', 16)}MESSAGE
        </Text>
      </Box>
      {data.map(n => (
        <Box key={n.id}>
          <Text dimColor>{pad(formatTime(n.timestamp), 8)}</Text>
          <Text color={SEVERITY_COLORS[n.severity] ?? 'white'}>
            {pad(n.severity, 10)}
          </Text>
          <Text>{pad(n.event, 14)}</Text>
          <Text>{pad(n.vmName ?? '-', 16)}</Text>
          <Text dimColor>{n.message}</Text>
        </Box>
      ))}

      <Box marginTop={1}>
        <Text dimColor>[b]ack</Text>
      </Box>
    </Box>
  )
}
