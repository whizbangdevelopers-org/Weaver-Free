import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TuiApiClient } from '../../client/api.js'
import type { AuditEntry } from '../../types/audit.js'
import { TierGateMessage } from '../TierGateMessage.js'
import { FeatureUnavailable } from '../FeatureUnavailable.js'

interface AuditViewProps {
  api: TuiApiClient
  tier: string
  onBack: () => void
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function AuditView({ api, tier, onBack }: AuditViewProps) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    void api.getAuditLog().then(result => {
      if (result.status === 200) {
        const r = result.data as { entries: AuditEntry[]; total: number }
        setEntries(r.entries)
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

    if (!entries || entries.length === 0) return

    if (key.upArrow || input === 'k') {
      setSelectedIndex(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex(i => Math.min(entries.length - 1, i + 1))
    }
  })

  if (blocked) {
    return <TierGateMessage feature="Audit log" requiredTier="fabrick" currentTier={tier} onBack={onBack} />
  }

  if (unavailable) {
    return <FeatureUnavailable feature="Audit Log" onBack={onBack} />
  }

  if (loading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color="yellow">Loading audit log...</Text>
      </Box>
    )
  }

  if (!entries) return null

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>Audit Log</Text>

      <Box marginTop={1}>
        <Text bold dimColor>
          {'  '}{pad('TIME', 8)}{pad('USER', 14)}{pad('ACTION', 16)}{pad('RESOURCE', 16)}{pad('OK', 5)}{pad('IP', 16)}
        </Text>
      </Box>

      {entries.map((entry, i) => {
        const selected = i === selectedIndex
        return (
          <Box key={entry.id}>
            <Text color={selected ? 'cyan' : undefined} bold={selected}>
              {selected ? '> ' : '  '}{pad(formatTime(entry.timestamp), 8)}
            </Text>
            <Text>{pad(entry.username, 14)}</Text>
            <Text>{pad(entry.action, 16)}</Text>
            <Text dimColor>{pad(entry.resource ?? '-', 16)}</Text>
            <Text color={entry.success ? 'green' : 'red'}>{pad(entry.success ? 'yes' : 'no', 5)}</Text>
            <Text dimColor>{pad(entry.ip ?? '-', 16)}</Text>
          </Box>
        )
      })}

      <Box marginTop={1}>
        <Text dimColor>[j/k] navigate [b]ack</Text>
      </Box>
    </Box>
  )
}
