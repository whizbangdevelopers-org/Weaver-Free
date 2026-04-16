import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TuiApiClient } from '../../client/api.js'
import type { VmTemplate } from '../../types/template.js'
import { TierGateMessage } from '../TierGateMessage.js'
import { FeatureUnavailable } from '../FeatureUnavailable.js'

interface TemplatesViewProps {
  api: TuiApiClient
  tier: string
  onBack: () => void
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

function formatMem(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)}GB`
  return `${mb}MB`
}

export function TemplatesView({ api, tier, onBack }: TemplatesViewProps) {
  const [data, setData] = useState<VmTemplate[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selected, setSelected] = useState<VmTemplate | null>(null)

  useEffect(() => {
    void api.listTemplates().then(result => {
      if (result.status === 200) {
        setData(result.data as VmTemplate[])
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

    if (key.return) {
      setSelected(data[selectedIndex]!)
      return
    }
  })

  if (blocked) {
    return <TierGateMessage feature="VM templates" requiredTier="weaver" currentTier={tier} onBack={onBack} />
  }

  if (unavailable) {
    return <FeatureUnavailable feature="VM Templates" onBack={onBack} />
  }

  if (loading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color="yellow">Loading templates...</Text>
      </Box>
    )
  }

  if (!data) return null

  // Detail view for selected template
  if (selected) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">{selected.name}</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>Description: {selected.description}</Text>
          <Text>Distro:      {selected.distro}</Text>
          <Text>Memory:      {formatMem(selected.mem)}</Text>
          <Text>vCPUs:       {selected.vcpu}</Text>
          <Text>Hypervisor:  {selected.hypervisor}</Text>
          <Text>Autostart:   <Text color={selected.autostart ? 'green' : 'gray'}>{selected.autostart ? 'yes' : 'no'}</Text></Text>
          <Text>Category:    {selected.category}</Text>
          {selected.tags && selected.tags.length > 0 && (
            <Text>Tags:        {selected.tags.join(', ')}</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Esc, b, or Enter to go back</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>VM Templates</Text>

      <Box marginTop={1}>
        <Text bold dimColor>
          {'  # '}{pad('NAME', 22)}{pad('DISTRO', 14)}{pad('MEM', 8)}{pad('CPU', 5)}{pad('HYPERVISOR', 18)}{pad('CATEGORY', 10)}
        </Text>
      </Box>
      {data.map((t, i) => {
        const isSel = i === selectedIndex
        return (
          <Box key={t.id}>
            <Text color={isSel ? 'cyan' : undefined} bold={isSel}>
              {isSel ? '> ' : '  '}{pad(String(i + 1), 2)}
            </Text>
            <Text color={isSel ? 'cyan' : undefined}>{pad(t.name, 22)}</Text>
            <Text>{pad(t.distro, 14)}</Text>
            <Text>{pad(formatMem(t.mem), 8)}</Text>
            <Text>{pad(`${t.vcpu}v`, 5)}</Text>
            <Text dimColor>{pad(t.hypervisor, 18)}</Text>
            <Text dimColor>{pad(t.category, 10)}</Text>
          </Box>
        )
      })}

      <Box marginTop={1}>
        <Text dimColor>[1-{Math.min(9, data.length)}] select  [j/k] navigate  [Enter] detail  [b]ack</Text>
      </Box>
    </Box>
  )
}
