import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TuiApiClient } from '../client/api.js'

interface VmLogsProps {
  vmName: string
  api: TuiApiClient
  onBack: () => void
}

const MAX_VISIBLE_LINES = 30

export function VmLogs({ vmName, api, onBack }: VmLogsProps) {
  const [logContent, setLogContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotFound(false)

    try {
      const result = await api.getVmLogs(vmName)
      if (result.status === 200) {
        const data = result.data as { name: string; log: string }
        setLogContent(data.log)
      } else if (result.status === 404) {
        setNotFound(true)
      } else {
        const data = result.data as { error?: string }
        setError(data.error ?? `Failed to fetch logs (${result.status})`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }, [api, vmName])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  useInput((input, key) => {
    if (key.escape || input === 'b') {
      onBack()
      return
    }
    if (input === 'r') {
      void fetchLogs()
      return
    }
  })

  // Loading state
  if (loading) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold>Provisioning Logs: {vmName}</Text>
        <Box marginTop={1}>
          <Text color="yellow">Loading logs...</Text>
        </Box>
      </Box>
    )
  }

  // 404 — no logs available
  if (notFound) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold>Provisioning Logs: {vmName}</Text>
        <Box marginTop={1}>
          <Text dimColor>No provisioning logs available for this VM</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[r]efresh [b]ack/Esc</Text>
        </Box>
      </Box>
    )
  }

  // Error state
  if (error) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold>Provisioning Logs: {vmName}</Text>
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[r]efresh [b]ack/Esc</Text>
        </Box>
      </Box>
    )
  }

  // Render log content
  const allLines = (logContent ?? '').split('\n')
  const visibleLines = allLines.slice(-MAX_VISIBLE_LINES)
  const hasMore = allLines.length > MAX_VISIBLE_LINES

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>Provisioning Logs: {vmName}</Text>

      <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        {hasMore && (
          <Text dimColor>[{'\u2191'}] {allLines.length - MAX_VISIBLE_LINES} more lines above</Text>
        )}
        {visibleLines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color="yellow">{'\u2501\u2501'} Want live log streaming? Upgrade to Weaver Solo {'\u2501\u2501'}</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>[r]efresh [b]ack/Esc</Text>
      </Box>
    </Box>
  )
}
