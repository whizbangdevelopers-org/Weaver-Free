import React from 'react'
import { Box, Text, useInput } from 'ink'

interface HelpViewProps {
  tier: string
  onBack: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold underline>{title}</Text>
      {children}
    </Box>
  )
}

function KeyRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <Box>
      <Box width={22}>
        <Text color="cyan">{keys}</Text>
      </Box>
      <Text>{desc}</Text>
    </Box>
  )
}

export function HelpView({ tier, onBack }: HelpViewProps) {
  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 'b') {
      onBack()
    }
  })

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>Weaver TUI — Help</Text>
      <Text dimColor>Current tier: {tier}</Text>

      <Section title="Navigation">
        <KeyRow keys="j / k / arrows" desc="Move selection up/down" />
        <KeyRow keys="d / Enter" desc="Open VM detail" />
        <KeyRow keys="b" desc="Go back" />
        <KeyRow keys="q" desc="Logout and quit" />
      </Section>

      <Section title="VM Actions">
        <KeyRow keys="s" desc="Start stopped VM" />
        <KeyRow keys="S" desc="Stop running VM" />
        <KeyRow keys="r" desc="Restart running VM" />
        <KeyRow keys="n" desc="Create new VM" />
        <KeyRow keys="x" desc="Delete VM (in detail view)" />
        <KeyRow keys="f" desc="Scan for existing workloads" />
      </Section>

      <Section title="VM Detail">
        <KeyRow keys="c" desc="Open console" />
        <KeyRow keys="l" desc="View provisioning logs" />
        <KeyRow keys="Ctrl+D" desc="Exit console / cancel form" />
      </Section>

      <Section title="List Features">
        <KeyRow keys="/" desc="Search VMs by name" />
        <KeyRow keys="t" desc="Cycle status filter" />
        <KeyRow keys="a" desc="Open AI agent dialog" />
        <KeyRow keys="D" desc="Distro catalog" />
      </Section>

      <Section title="AI Agent (in dialog)">
        <KeyRow keys="type + Enter" desc="Send prompt to AI agent" />
        <KeyRow keys="b" desc="Close agent dialog" />
      </Section>

      <Section title="Account">
        <KeyRow keys="L" desc="Logout" />
      </Section>

      <Section title="Weaver Solo Features">
        <KeyRow keys="N" desc="Network topology" />
        <KeyRow keys="T" desc="VM templates" />
        <KeyRow keys="H" desc="Host information" />
        <KeyRow keys="I" desc="Notifications" />
        <KeyRow keys="," desc="Settings" />
      </Section>

      <Section title="FabricK Features">
        <KeyRow keys="u" desc="User management" />
        <KeyRow keys="A" desc="Audit log" />
      </Section>

      <Section title="Tier Feature Matrix">
        <Box flexDirection="column">
          <Box>
            <Box width={28}><Text bold dimColor>Feature</Text></Box>
            <Box width={8}><Text bold dimColor>Free</Text></Box>
            <Box width={10}><Text bold dimColor>Solo</Text></Box>
            <Box width={12}><Text bold dimColor>FabricK</Text></Box>
          </Box>
          <Box>
            <Box width={28}><Text>VM management</Text></Box>
            <Box width={8}><Text color="green">yes</Text></Box>
            <Box width={10}><Text color="green">yes</Text></Box>
            <Box width={12}><Text color="green">yes</Text></Box>
          </Box>
          <Box>
            <Box width={28}><Text>AI agent (BYOK)</Text></Box>
            <Box width={8}><Text color="green">yes</Text></Box>
            <Box width={10}><Text color="green">yes</Text></Box>
            <Box width={12}><Text color="green">yes</Text></Box>
          </Box>
          <Box>
            <Box width={28}><Text>Network topology</Text></Box>
            <Box width={8}><Text color="red">-</Text></Box>
            <Box width={10}><Text color="green">yes</Text></Box>
            <Box width={12}><Text color="green">yes</Text></Box>
          </Box>
          <Box>
            <Box width={28}><Text>Distro catalog</Text></Box>
            <Box width={8}><Text color="green">yes</Text></Box>
            <Box width={10}><Text color="green">yes</Text></Box>
            <Box width={12}><Text color="green">yes</Text></Box>
          </Box>
          <Box>
            <Box width={28}><Text>VM templates</Text></Box>
            <Box width={8}><Text color="red">-</Text></Box>
            <Box width={10}><Text color="green">yes</Text></Box>
            <Box width={12}><Text color="green">yes</Text></Box>
          </Box>
          <Box>
            <Box width={28}><Text>Host info</Text></Box>
            <Box width={8}><Text color="red">-</Text></Box>
            <Box width={10}><Text color="green">yes</Text></Box>
            <Box width={12}><Text color="green">yes</Text></Box>
          </Box>
          <Box>
            <Box width={28}><Text>User management</Text></Box>
            <Box width={8}><Text color="red">-</Text></Box>
            <Box width={10}><Text color="red">-</Text></Box>
            <Box width={12}><Text color="green">yes</Text></Box>
          </Box>
          <Box>
            <Box width={28}><Text>Audit log</Text></Box>
            <Box width={8}><Text color="red">-</Text></Box>
            <Box width={10}><Text color="red">-</Text></Box>
            <Box width={12}><Text color="green">yes</Text></Box>
          </Box>
        </Box>
      </Section>

      <Box marginTop={1}>
        <Text dimColor>Press b or q to go back</Text>
      </Box>
    </Box>
  )
}
