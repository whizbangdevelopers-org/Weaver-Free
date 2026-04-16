import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TuiApiClient } from '../client/api.js'
import type { DistroEntry } from '../types/distro.js'
import { TierGateMessage } from './TierGateMessage.js'
import { FeatureUnavailable } from './FeatureUnavailable.js'

interface DistrosViewProps {
  api: TuiApiClient
  tier: string
  onBack: () => void
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

export function DistrosView({ api, tier, onBack }: DistrosViewProps) {
  const [data, setData] = useState<DistroEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selected, setSelected] = useState<DistroEntry | null>(null)

  useEffect(() => {
    void api.listDistros().then(result => {
      if (result.status === 200) {
        setData(result.data as DistroEntry[])
      } else if (result.status === 403) {
        setBlocked(true)
      } else {
        setUnavailable(true)
      }
      setLoading(false)
    })
  }, [api])

  useInput((input, key) => {
    if (selected) {
      // In detail view — any key goes back to list
      if (key.escape || input === 'b' || key.return) {
        setSelected(null)
      }
      return
    }

    if (key.escape || input === 'b') { onBack(); return }

    if (!data || data.length === 0) return

    // Number keys 1-9 for direct selection
    const num = parseInt(input, 10)
    if (num >= 1 && num <= Math.min(9, data.length)) {
      setSelected(data[num - 1]!)
      return
    }

    // j/k navigation
    if (key.upArrow || input === 'k') {
      setSelectedIndex(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex(i => Math.min(data.length - 1, i + 1))
      return
    }

    // Enter to select highlighted
    if (key.return) {
      setSelected(data[selectedIndex]!)
      return
    }
  })

  if (blocked) {
    return <TierGateMessage feature="Distro catalog" requiredTier="weaver" currentTier={tier} onBack={onBack} />
  }

  if (unavailable) {
    return <FeatureUnavailable feature="Distro Catalog" onBack={onBack} />
  }

  if (loading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color="yellow">Loading distro catalog...</Text>
      </Box>
    )
  }

  if (!data) return null

  // Detail view for selected distro
  if (selected) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">{selected.label}</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>Name:       {selected.name}</Text>
          <Text>Format:     {selected.format}</Text>
          <Text>Category:   {selected.category}</Text>
          <Text>Cloud-init: <Text color={selected.cloudInit ? 'green' : 'gray'}>{selected.cloudInit ? 'yes' : 'no'}</Text></Text>
          <Text>Guest OS:   {selected.guestOs}</Text>
          <Text>URL:        <Text dimColor>{selected.url}</Text></Text>
          {selected.description && <Text>Description: {selected.description}</Text>}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Esc, b, or Enter to go back</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>Distro Catalog</Text>

      <Box marginTop={1}>
        <Text bold dimColor>
          {'  # '}{pad('NAME', 20)}{pad('LABEL', 22)}{pad('FORMAT', 8)}{pad('CLOUD-INIT', 12)}{pad('CATEGORY', 10)}
        </Text>
      </Box>
      {data.map((d, i) => {
        const isSel = i === selectedIndex
        return (
          <Box key={d.name}>
            <Text color={isSel ? 'cyan' : undefined} bold={isSel}>
              {isSel ? '> ' : '  '}{pad(String(i + 1), 2)}
            </Text>
            <Text color={isSel ? 'cyan' : undefined}>{pad(d.name, 20)}</Text>
            <Text>{pad(d.label, 22)}</Text>
            <Text dimColor>{pad(d.format, 8)}</Text>
            <Text color={d.cloudInit ? 'green' : 'gray'}>{pad(d.cloudInit ? 'yes' : 'no', 12)}</Text>
            <Text dimColor>{pad(d.category, 10)}</Text>
          </Box>
        )
      })}

      <Box marginTop={1}>
        <Text dimColor>[1-{Math.min(9, data.length)}] select  [j/k] navigate  [Enter] detail  [b]ack</Text>
      </Box>
    </Box>
  )
}
